const User = require("../models/User")
const { track } = require("../lib/analytics")

// ============================================================
// Vérifier si une restriction est active
// ============================================================
function isRestricted(user, type) {
    if (!user.restrictions || !user.restrictions[type]) return false
    const until = user.restrictions[type].until
    if (!until) return false
    return new Date() < new Date(until)
}

module.exports.isRestricted = isRestricted

// ============================================================
// requireAuth — vérifie la session + statut du compte
// ============================================================
module.exports.requireAuth = async (req, res, next) => {
    if (!req.session.user) {
        req.flash("error", "Tu dois être connecté pour accéder à cette page !")
        return res.redirect("/login")
    }

    try {
        const user = await User.findById(req.session.user.id)

        if (!user) {
            req.session.destroy(() => {})
            return res.redirect("/login")
        }

        // Compte supprimé
        if (user.deletionReason && user.nom === "Compte supprimé") {
            req.session.destroy(() => {})
            return res.render("account-deleted", {
                title: "Compte supprimé",
                reason: user.deletionReason
            })
        }

        // Compte désactivé
        if (user.isDisabled) {
            req.session.destroy(() => {})
            return res.render("account-disabled", {
                title: "Compte désactivé",
                reason: user.disableReason || "Non spécifié",
                contact: user.disableContact || null
            })
        }

        // ============================================================
        // === ORACLE / ANALYTICS : mise à jour lastSeen (atomique) ===
        // ============================================================
        await User.updateOne({ _id: user._id }, { $set: { lastSeen: new Date() } })

        next()
    } catch (e) {
        return res.redirect("/login")
    }
}

// ============================================================
// isAuth — alias léger de requireAuth pour les paramètres
// ============================================================
module.exports.isAuth = (req, res, next) => {
    if (!req.session.user) {
        req.flash("error", "Tu dois être connecté pour accéder à cette page !")
        return res.redirect("/login")
    }
    next()
}

// ============================================================
// redirectIfAuth
// ============================================================
module.exports.redirectIfAuth = (req, res, next) => {
    if (req.session.user) {
        return res.redirect("/")
    }
    next()
}

// ============================================================
// requireAdmin
// ============================================================
module.exports.requireAdmin = async (req, res, next) => {
    if (!req.session.user) {
        req.flash("error", "Tu dois être connecté.")
        return res.redirect("/login")
    }

    try {
        const user = await User.findById(req.session.user.id)
        if (!user || user.role !== "admin") {
            req.flash("error", "Accès réservé aux administrateurs.")
            return res.redirect("/")
        }
        next()
    } catch (e) {
        res.redirect("/")
    }
}

// ============================================================
// requireNotRestricted — middleware par type d'action
// ============================================================
module.exports.requireNotRestricted = (type) => {
    return async (req, res, next) => {
        try {
            const user = await User.findById(req.session.user.id)
            if (!user) return res.status(401).json({ error: "Non authentifié" })

            if (isRestricted(user, type)) {
                const until = new Date(user.restrictions[type].until)
                const minutesLeft = Math.ceil((until - Date.now()) / 60000)

                if (req.xhr || req.headers.accept?.includes("application/json")) {
                    return res.status(403).json({
                        error: `Tu es restreint(e) sur cette action pendant encore ${minutesLeft} minute(s).`,
                        restricted: true,
                        until
                    })
                }

                req.flash("error", `Tu es restreint(e) sur cette action pendant encore ${minutesLeft} minute(s).`)
                return res.redirect("back")
            }

            next()
        } catch (e) {
            console.error(e)
            res.status(500).json({ error: "Erreur serveur" })
        }
    }
}
