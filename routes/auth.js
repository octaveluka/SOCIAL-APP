const express = require("express")
const router = express.Router()
const bcrypt = require("bcryptjs")
const crypto = require("crypto")
const User = require("../models/User")
const Group = require("../models/Group")
const { redirectIfAuth, isAuth } = require("../middleware/auth")
const { uploadProfile } = require("../lib/cloudinary")
const { nomValide } = require("../lib/validation")
const assistant = require("../lib/assistant")
const { track } = require("../lib/analytics")
const { generateAvatar } = require("../lib/avatar")
const ids = require("../lib/intrusionDetection")

const SECURITY_QUESTIONS = [
    "Quel est le prénom de votre père ?",
    "Quel est le nom de jeune fille de votre mère ?",
    "Quel est le prénom de votre meilleur(e) ami(e) d'enfance ?",
    "Dans quelle ville êtes-vous né(e) ?",
    "Quel est le nom de votre animal de compagnie d'enfance ?",
    "Quel est le nom de votre école primaire ?",
    "Quel était le modèle de votre première voiture ?",
    "Quel est le surnom que vous donnait votre famille ?"
]

function generateRecoveryCodes(count = 8) {
    const codes = []
    for (let i = 0; i < count; i++) {
        const part1 = crypto.randomBytes(3).toString("hex").toUpperCase()
        const part2 = crypto.randomBytes(3).toString("hex").toUpperCase()
        codes.push(`${part1}-${part2}`)
    }
    return codes
}

async function hashAnswer(answer) {
    return bcrypt.hash(answer.trim().toLowerCase(), 10)
}

async function verifyAnswer(plain, hashed) {
    return bcrypt.compare(plain.trim().toLowerCase(), hashed)
}

// =============================================
// MOT DE PASSE OUBLIÉ — ÉTAPE 1 : EMAIL
// =============================================
router.get("/forgot-password", redirectIfAuth, (req, res) => {
    res.render("forgot-password", {
        title: "Mot de passe oublié",
        error: req.flash("error"),
        success: req.flash("success")
    })
})

router.post("/forgot-password", redirectIfAuth, async (req, res) => {
    try {
        const { email } = req.body
        if (!email) {
            req.flash("error", "Veuillez entrer votre adresse email.")
            return res.redirect("/forgot-password")
        }

        const user = await User.findOne({ email: email.toLowerCase() })
        // FIX-04: pas d'énumération d'email — message générique quel que soit le résultat
        if (!user || !user.securityQuestion || !user.securityAnswer) {
            req.flash("success", "Si un compte correspond à cet email, une question de sécurité vous sera posée.")
            return res.redirect("/forgot-password")
        }

        req.session.resetEmail = email.toLowerCase()
        res.redirect("/security-question")

    } catch (err) {
        console.error("Erreur forgot-password:", err)
        req.flash("error", "Une erreur est survenue.")
        res.redirect("/forgot-password")
    }
})

// =============================================
// MOT DE PASSE OUBLIÉ — ÉTAPE 2 : QUESTION
// =============================================
router.get("/security-question", redirectIfAuth, async (req, res) => {
    if (!req.session.resetEmail) {
        req.flash("error", "Veuillez d'abord entrer votre email.")
        return res.redirect("/forgot-password")
    }

    const user = await User.findOne({ email: req.session.resetEmail })
    if (!user) return res.redirect("/forgot-password")

    res.render("security-question", {
        title: "Question de sécurité",
        question: user.securityQuestion,
        email: req.session.resetEmail,
        error: req.flash("error"),
        success: req.flash("success")
    })
})

router.post("/security-question", redirectIfAuth, async (req, res) => {
    try {
        if (!req.session.resetEmail) {
            return res.redirect("/forgot-password")
        }

        const { reponse, recoveryCode } = req.body
        const user = await User.findOne({ email: req.session.resetEmail })

        if (!user) {
            req.flash("error", "Utilisateur introuvable.")
            return res.redirect("/forgot-password")
        }

        let verified = false

        if (recoveryCode && recoveryCode.trim()) {
            const code = recoveryCode.trim().toUpperCase()
            for (let i = 0; i < user.recoveryCodes.length; i++) {
                const match = await bcrypt.compare(code, user.recoveryCodes[i])
                if (match) {
                    user.recoveryCodes.splice(i, 1)
                    await user.save()
                    verified = true
                    break
                }
            }
            if (!verified) {
                req.flash("error", "Code de récupération invalide ou déjà utilisé.")
                return res.redirect("/security-question")
            }
        } else if (reponse && reponse.trim()) {
            verified = await verifyAnswer(reponse, user.securityAnswer)
            if (!verified) {
                req.flash("error", "Réponse incorrecte. Réessayez.")
                return res.redirect("/security-question")
            }
        } else {
            req.flash("error", "Veuillez répondre à la question ou entrer un code de récupération.")
            return res.redirect("/security-question")
        }

        req.session.resetVerified = true
        res.redirect("/reset-password")

    } catch (err) {
        console.error("Erreur security-question:", err)
        req.flash("error", "Une erreur est survenue.")
        res.redirect("/security-question")
    }
})

// =============================================
// MOT DE PASSE OUBLIÉ — ÉTAPE 3 : NOUVEAU MDP
// =============================================
router.get("/reset-password", redirectIfAuth, (req, res) => {
    if (!req.session.resetEmail || !req.session.resetVerified) {
        req.flash("error", "Accès non autorisé.")
        return res.redirect("/forgot-password")
    }

    res.render("reset-password", {
        title: "Nouveau mot de passe",
        email: req.session.resetEmail,
        error: req.flash("error"),
        success: req.flash("success")
    })
})

router.post("/reset-password", redirectIfAuth, async (req, res) => {
    try {
        if (!req.session.resetEmail || !req.session.resetVerified) {
            return res.redirect("/forgot-password")
        }

        const { motDePasse, confirmMotDePasse } = req.body

        if (!motDePasse || !confirmMotDePasse) {
            req.flash("error", "Tous les champs sont obligatoires.")
            return res.redirect("/reset-password")
        }

        if (motDePasse !== confirmMotDePasse) {
            req.flash("error", "Les mots de passe ne correspondent pas.")
            return res.redirect("/reset-password")
        }

        if (motDePasse.length < 8) {
            req.flash("error", "Le mot de passe doit contenir au moins 8 caractères.")
            return res.redirect("/reset-password")
        }

        const user = await User.findOne({ email: req.session.resetEmail })
        if (!user) {
            req.flash("error", "Utilisateur introuvable.")
            return res.redirect("/forgot-password")
        }

        user.motDePasse = motDePasse
        await user.save()

        req.session.resetEmail = null
        req.session.resetVerified = null
        req.flash("success", "Mot de passe réinitialisé avec succès !")
        res.redirect("/login")

    } catch (err) {
        console.error("Erreur reset-password:", err)
        req.flash("error", "Une erreur est survenue.")
        res.redirect("/reset-password")
    }
})

// =============================================
// PARAMÈTRES — CHANGER MOT DE PASSE
// =============================================
router.get("/settings/password", isAuth, (req, res) => {
    res.render("settings-password", {
        title: "Modifier le mot de passe",
        currentPage: "profile",
        error: req.flash("error"),
        success: req.flash("success")
    })
})

router.post("/settings/password", isAuth, async (req, res) => {
    try {
        const { ancienMotDePasse, motDePasse, confirmMotDePasse } = req.body
        const user = await User.findById(req.session.user.id)

        if (!user) return res.redirect("/login")

        const match = await bcrypt.compare(ancienMotDePasse, user.motDePasse)
        if (!match) {
            req.flash("error", "Mot de passe actuel incorrect.")
            return res.redirect("/settings/password")
        }

        if (motDePasse !== confirmMotDePasse) {
            req.flash("error", "Les nouveaux mots de passe ne correspondent pas.")
            return res.redirect("/settings/password")
        }

        if (motDePasse.length < 8) {
            req.flash("error", "Le mot de passe doit contenir au moins 8 caractères.")
            return res.redirect("/settings/password")
        }

        user.motDePasse = motDePasse
        await user.save()

        req.flash("success", "Mot de passe modifié avec succès !")
        res.redirect("/settings/password")

    } catch (err) {
        console.error("Erreur settings/password:", err)
        req.flash("error", "Une erreur est survenue.")
        res.redirect("/settings/password")
    }
})

// =============================================
// PARAMÈTRES — QUESTION DE SÉCURITÉ
// =============================================
router.get("/settings/security-question", isAuth, async (req, res) => {
    const user = await User.findById(req.session.user.id)
    res.render("settings-security-question", {
        title: "Question de sécurité",
        currentPage: "profile",
        questions: SECURITY_QUESTIONS,
        currentQuestion: user ? user.securityQuestion : null,
        hasAnswer: user ? !!user.securityAnswer : false,
        codesCount: user ? user.recoveryCodes.length : 0,
        error: req.flash("error"),
        success: req.flash("success")
    })
})

router.post("/settings/security-question", isAuth, async (req, res) => {
    try {
        const { securityQuestion, securityAnswer, motDePasse } = req.body
        const user = await User.findById(req.session.user.id)

        if (!user) return res.redirect("/login")

        const match = await bcrypt.compare(motDePasse, user.motDePasse)
        if (!match) {
            req.flash("error", "Mot de passe incorrect.")
            return res.redirect("/settings/security-question")
        }

        if (!securityQuestion || !securityAnswer || securityAnswer.trim().length < 2) {
            req.flash("error", "Veuillez choisir une question et entrer une réponse.")
            return res.redirect("/settings/security-question")
        }

        user.securityQuestion = securityQuestion
        user.securityAnswer = await hashAnswer(securityAnswer)
        await user.save()

        req.flash("success", "Question de sécurité mise à jour avec succès !")
        res.redirect("/settings/security-question")

    } catch (err) {
        console.error("Erreur settings/security-question:", err)
        req.flash("error", "Une erreur est survenue.")
        res.redirect("/settings/security-question")
    }
})

// =============================================
// PARAMÈTRES — RÉGÉNÉRER CODES DE RÉCUPÉRATION
// =============================================
router.post("/settings/recovery-codes", isAuth, async (req, res) => {
    try {
        const { motDePasse } = req.body
        const user = await User.findById(req.session.user.id)

        if (!user) return res.status(401).json({ error: "Non autorisé" })

        const match = await bcrypt.compare(motDePasse, user.motDePasse)
        if (!match) return res.status(401).json({ error: "Mot de passe incorrect." })

        const plainCodes = generateRecoveryCodes(8)
        const hashedCodes = await Promise.all(plainCodes.map(c => bcrypt.hash(c, 10)))

        user.recoveryCodes = hashedCodes
        await user.save()

        res.json({ success: true, codes: plainCodes })

    } catch (err) {
        console.error("Erreur recovery-codes:", err)
        res.status(500).json({ error: "Une erreur est survenue." })
    }
})

// =============================================
// PAGE CODES DE RÉCUPÉRATION (POST-INSCRIPTION)
// =============================================
router.get("/register/codes", redirectIfAuth, (req, res) => {
    if (!req.session.newUserCodes) {
        return res.redirect("/login")
    }

    const codes = req.session.newUserCodes
    req.session.newUserCodes = null

    res.render("register-codes", {
        title: "Vos codes de récupération",
        codes
    })
})

// =============================================
// ÉTAPE PHOTO DE PROFIL (POST-INSCRIPTION)
// =============================================
router.get("/register/photo", (req, res) => {
    if (!req.session.newUserId && !(req.session.user)) {
        return res.redirect("/login")
    }
    const userId = req.session.newUserId || req.session.user.id
    const currentAvatar = generateAvatar(userId)
    res.render("register-photo", {
        title: "Ta photo de profil",
        currentAvatar
    })
})

router.get("/register/photo/skip", async (req, res) => {
    if (!req.session.newUserId) {
        return res.redirect("/login")
    }
    req.session.newUserId = null
    res.redirect("/login")
})

router.post("/register/photo", uploadProfile.single("photoProfil"), async (req, res) => {
    const userId = req.session.newUserId || (req.session.user && req.session.user.id)
    if (!userId) return res.redirect("/login")

    try {
        if (req.file) {
            await User.findByIdAndUpdate(userId, { photoProfil: req.file.path })
        }
    } catch (e) {
        console.error("Erreur upload photo profil:", e.message)
    }

    req.session.newUserId = null
    res.redirect("/login")
})

// =============================================
// PAGE DE CONNEXION
// =============================================
router.get("/login", redirectIfAuth, (req, res) => {
    res.render("login", { title: "Connexion" })
})

router.post("/login", async (req, res) => {
    try {
        const { email, motDePasse } = req.body
        if (!email || !motDePasse) {
            req.flash("error", "Email et mot de passe requis.")
            return res.redirect("/login")
        }
        const user = await User.findOne({ email: email.toLowerCase() })

        if (!user) {
            req.flash("error", "Email ou mot de passe incorrect.")
            return res.redirect("/login")
        }

        const match = await bcrypt.compare(motDePasse, user.motDePasse)
        if (!match) {
            // FIX-06: enregistrer l'échec de connexion pour l'IDS
            await ids.recordFailedLogin(req, email.toLowerCase())
            req.flash("error", "Email ou mot de passe incorrect.")
            return res.redirect("/login")
        }

        if (user.deletionReason && user.nom === "Compte supprimé") {
            return res.render("account-deleted", {
                title: "Compte supprimé",
                reason: user.deletionReason
            })
        }

        if (user.isDisabled) {
            return res.render("account-disabled", {
                title: "Compte désactivé",
                reason: user.disableReason || "Non spécifié",
                contact: user.disableContact || null
            })
        }

        // FIX-03: régénérer l'ID de session après connexion (session fixation)
        await new Promise((resolve, reject) => {
            req.session.regenerate(err => err ? reject(err) : resolve())
        })

        req.session.user = {
            id: user._id,
            nom: user.nom,
            email: user.email,
            photoProfil: user.photoProfil,
            role: user.role,
            theme: user.theme || "default",
            isIncognitoInput: user.isIncognitoInput || false
        }

        // FIX-06: effacer le compteur d'échecs IDS pour cette IP
        ids.clearLoginFailures(req)

        user.enLigne = true
        await user.save()

        await track(user._id, 'LOGIN')

        try {
            await ensureSystemGroups()
            await addUserToSystemGroups(user._id)
        } catch(e) {}

        res.redirect("/")
    } catch (err) {
        console.error(err)
        req.flash("error", "Une erreur est survenue.")
        res.redirect("/login")
    }
})

// =============================================
// PAGE D'INSCRIPTION
// =============================================
router.get("/register", redirectIfAuth, (req, res) => {
    res.render("register", {
        title: "Inscription",
        questions: SECURITY_QUESTIONS,
        error: req.flash("error")
    })
})

router.post("/register", redirectIfAuth, async (req, res) => {
    try {
        const { nom, email, motDePasse, confirmMotDePasse, securityQuestion, securityAnswer } = req.body

        if (!nom || !email || !motDePasse) {
            req.flash("error", "Tous les champs sont requis.")
            return res.redirect("/register")
        }

        if (!nomValide(nom)) {
            req.flash("error", "Le nom ne doit contenir que des lettres, chiffres, espaces, tirets ou apostrophes (2 à 30 caractères).")
            return res.redirect("/register")
        }

        if (motDePasse !== confirmMotDePasse) {
            req.flash("error", "Les mots de passe ne correspondent pas.")
            return res.redirect("/register")
        }

        if (motDePasse.length < 8) {
            req.flash("error", "Le mot de passe doit contenir au moins 8 caractères.")
            return res.redirect("/register")
        }

        if (!securityQuestion || !SECURITY_QUESTIONS.includes(securityQuestion) || !securityAnswer || securityAnswer.trim().length < 2) {
            req.flash("error", "Veuillez choisir une question de sécurité valide et entrer une réponse.")
            return res.redirect("/register")
        }

        const existingUser = await User.findOne({ email: email.toLowerCase() })
        if (existingUser) {
            req.flash("error", "Un compte existe déjà avec cet email.")
            return res.redirect("/register")
        }

        const humanCount = await User.countDocuments({ isBot: { $ne: true } })
        const role = humanCount === 0 ? "admin" : "user"

        const plainCodes = generateRecoveryCodes(8)
        const hashedCodes = await Promise.all(plainCodes.map(c => bcrypt.hash(c, 10)))

        const newUser = new User({
            nom: nom.trim(),
            email: email.toLowerCase(),
            motDePasse,
            role,
            securityQuestion,
            securityAnswer: await hashAnswer(securityAnswer),
            recoveryCodes: hashedCodes
        })
        newUser.photoProfil = generateAvatar(newUser._id)
        await newUser.save()

        await assistant.sendWelcomeMessage(newUser._id)
        await ensureSystemGroups()
        await addUserToSystemGroups(newUser._id)

        newUser.walletBalance = 100
        newUser.xp = 10
        await newUser.save()

        await track(newUser._id, 'REGISTER')

        req.session.newUserCodes = plainCodes
        req.session.newUserId = newUser._id.toString()

        res.redirect("/register/codes")
    } catch (err) {
        console.error(err)
        req.flash("error", "Une erreur est survenue.")
        res.redirect("/register")
    }
})

// =============================================
// DÉCONNEXION
// =============================================
router.get("/logout", async (req, res) => {
    if (req.session.user) {
        try {
            const user = await User.findById(req.session.user.id)
            if (user) {
                user.enLigne = false
                user.derniereConnexion = new Date()
                await user.save()
            }
        } catch (e) {}
    }
    req.session.destroy(() => { res.redirect("/login") })
})

// =============================================
// FONCTIONS SYSTÈME
// =============================================
async function ensureSystemGroups() {
    const adminUser = await User.findOne({ role: "admin", isBot: false })
    if (!adminUser) return null

    const groups = {}

    for (const cfg of [
        { key: "avis_solutions", nom: "Avis & Solutions", emoji: "💡", desc: "Feedback, entraide et suggestions" },
        { key: "primes", nom: "Primes", emoji: "💰", desc: "Annonces et quêtes pour gagner des crédits" }
    ]) {
        let grp = await Group.findOne({ systemGroupKey: cfg.key })
        if (!grp) {
            grp = await Group.create({
                nom: cfg.nom,
                createur: adminUser._id,
                membres: [{ user: adminUser._id, isAdmin: true }],
                inviteCode: crypto.randomBytes(6).toString("hex"),
                isPermanent: true,
                isSystemGroup: true,
                systemGroupKey: cfg.key,
                photo: `https://ui-avatars.com/api/?background=4f46e5&color=fff&name=${encodeURIComponent(cfg.emoji)}&bold=true`
            })
            console.log(`✅ Groupe système créé : ${cfg.nom}`)
        }
        groups[cfg.key] = grp
    }
    return groups
}

async function addUserToSystemGroups(userId) {
    try {
        const systemGroups = await Group.find({ isSystemGroup: true })
        for (const grp of systemGroups) {
            const alreadyIn = grp.membres.some(m => m.user.toString() === userId.toString())
            if (!alreadyIn) {
                grp.membres.push({ user: userId, isAdmin: false })
                await grp.save()
            }
        }
    } catch (e) {
        console.error("Erreur addUserToSystemGroups:", e.message)
    }
}

module.exports = router
module.exports.ensureSystemGroups = ensureSystemGroups
module.exports.addUserToSystemGroups = addUserToSystemGroups
