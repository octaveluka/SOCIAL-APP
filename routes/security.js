const express = require("express")
const router = express.Router()
const bcrypt = require("bcryptjs")
const { requireAuth } = require("../middleware/auth")
const User = require("../models/User")
const SubProfile = require("../models/SubProfile")

// =============================================
// GHOST TYPING (Incognito Input)
// =============================================
router.post("/api/settings/incognito-input", requireAuth, async (req, res) => {
    try {
        const { enabled } = req.body
        const user = await User.findById(req.session.user.id)
        user.isIncognitoInput = !!enabled
        await user.save()
        req.session.user.isIncognitoInput = user.isIncognitoInput
        res.json({ success: true, isIncognitoInput: user.isIncognitoInput })
    } catch (err) {
        res.status(500).json({ error: "Erreur serveur." })
    }
})

// =============================================
// COFFRE-FORT (PIN par conversation)
// =============================================

router.post("/api/vault/lock/:otherId", requireAuth, async (req, res) => {
    try {
        const { pin } = req.body
        if (!pin || pin.length < 4) return res.status(400).json({ error: "PIN de 4 chiffres minimum." })
        const user = await User.findById(req.session.user.id)
        const hashedPin = await bcrypt.hash(pin, 10)
        user.vaultedChats.set(req.params.otherId, hashedPin)
        await user.save()
        res.json({ success: true, message: "Conversation verrouillée." })
    } catch (err) {
        res.status(500).json({ error: "Erreur serveur." })
    }
})

router.post("/api/vault/unlock/:otherId", requireAuth, async (req, res) => {
    try {
        const { pin } = req.body
        const user = await User.findById(req.session.user.id)
        const hashedPin = user.vaultedChats.get(req.params.otherId)
        if (!hashedPin) return res.json({ success: true, locked: false })
        const match = await bcrypt.compare(pin, hashedPin)
        if (!match) return res.status(403).json({ error: "PIN incorrect." })
        res.json({ success: true, unlocked: true })
    } catch (err) {
        res.status(500).json({ error: "Erreur serveur." })
    }
})

router.delete("/api/vault/lock/:otherId", requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id)
        user.vaultedChats.delete(req.params.otherId)
        await user.save()
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: "Erreur serveur." })
    }
})

router.get("/api/vault/status/:otherId", requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id)
        const locked = user.vaultedChats.has(req.params.otherId)
        res.json({ locked })
    } catch (err) {
        res.status(500).json({ error: "Erreur serveur." })
    }
})

// =============================================
// PAGE PARAMÈTRES PRINCIPALE
// =============================================

router.get("/settings", requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id)
            .select("nom email photoProfil hideOnlineStatus isIncognitoInput showInSearch allowMessagesFrom aiCloneActive aiCloneInstructions aiCloneExpiry walletBalance")
        res.render("settings", {
            title: "Paramètres",
            user: { ...req.session.user, ...user.toObject() },
            success: req.query.success || null
        })
    } catch (err) {
        res.status(500).send("Erreur serveur.")
    }
})

// Masquer le statut en ligne
router.post("/api/settings/hide-online", requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id)
        user.hideOnlineStatus = !!req.body.enabled
        await user.save()
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: "Erreur serveur." })
    }
})

// Apparaître dans la recherche
router.post("/api/settings/show-in-search", requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id)
        user.showInSearch = !!req.body.enabled
        await user.save()
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: "Erreur serveur." })
    }
})

// Qui peut envoyer des messages
router.post("/api/settings/allow-messages", requireAuth, async (req, res) => {
    try {
        const { value } = req.body
        if (!["all", "friends", "none"].includes(value)) return res.status(400).json({ error: "Valeur invalide." })
        const user = await User.findById(req.session.user.id)
        user.allowMessagesFrom = value
        await user.save()
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: "Erreur serveur." })
    }
})


// Clone IA — instructions
router.post("/api/settings/ai-clone-instructions", requireAuth, async (req, res) => {
    try {
        const { instructions } = req.body
        const user = await User.findById(req.session.user.id)
        user.aiCloneInstructions = String(instructions || "").slice(0, 500)
        await user.save()
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: "Erreur serveur." })
    }
})

// Supprimer le compte
router.delete("/api/settings/delete-account", requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id
        const Post = require("../models/Post")
        const Message = require("../models/Message")
        const Notification = require("../models/Notification")
        const Story = require("../models/Story")
        const Bounty = require("../models/Bounty")
        const DailyQuest = require("../models/DailyQuest")
        const DailyTask = require("../models/DailyTask")
        const SubProfile = require("../models/SubProfile")
        const Analytics = require("../models/Analytics")
        const Group = require("../models/Group")

        // Tout supprimer en parallèle — aucun gâchis en base
        await Promise.all([
            // Contenu créé par l'utilisateur
            Post.deleteMany({ auteur: userId }),
            Message.deleteMany({ $or: [{ expediteur: userId }, { destinataire: userId }] }),
            Notification.deleteMany({ $or: [{ destinataire: userId }, { expediteur: userId }] }),
            Story.deleteMany({ auteur: userId }),
            Bounty.deleteMany({ createdBy: userId }),
            DailyQuest.deleteMany({ userId }),
            Analytics.deleteMany({ userId }),
            SubProfile.deleteMany({ userId }),

            // Nettoyer les tâches quotidiennes (retirer les completions de cet user)
            DailyTask.updateMany(
                { "completions.userId": userId },
                { $pull: { completions: { userId } } }
            ),

            // Retirer l'user de tous les groupes où il est membre
            Group.updateMany(
                { "membres.user": userId },
                { $pull: { membres: { user: userId } } }
            ),

            // Retirer l'user des listes sociales des autres utilisateurs
            User.updateMany(
                { $or: [
                    { amis: userId },
                    { demandesRecues: userId },
                    { demandesEnvoyees: userId },
                    { followers: userId },
                    { following: userId },
                    { blockedUsers: userId }
                ]},
                { $pull: {
                    amis: userId,
                    demandesRecues: userId,
                    demandesEnvoyees: userId,
                    followers: userId,
                    following: userId,
                    blockedUsers: userId
                }}
            ),
        ])

        // Supprimer les groupes dont il était le seul créateur et qui sont vides
        await Group.deleteMany({ createur: userId, isPermanent: false, membres: { $size: 0 } })

        // Supprimer le compte
        await User.findByIdAndDelete(userId)
        req.session.destroy()
        res.json({ success: true })
    } catch (err) {
        console.error("Delete account error:", err)
        res.status(500).json({ error: "Erreur serveur." })
    }
})

// =============================================
// SOUS-PROFILS ANONYMES — PAGE SETTINGS
// =============================================

router.get("/settings/sub-profiles", requireAuth, async (req, res) => {
    try {
        res.render("settings-sub-profiles", {
            title: "Profils anonymes",
            user: req.session.user
        })
    } catch (err) {
        res.status(500).send("Erreur serveur.")
    }
})

// =============================================
// SOUS-PROFILS ANONYMES — API
// =============================================

// Créer un sous-profil (max 2, avec nom + avatar personnalisés)
router.post("/api/subprofiles", requireAuth, async (req, res) => {
    try {
        const existing = await SubProfile.countDocuments({ userId: req.session.user.id })
        if (existing >= 2) {
            return res.status(400).json({ error: "Maximum 2 profils anonymes par compte." })
        }

        let { anonymousUsername, anonymousAvatarUrl } = req.body

        // Si pas de données custom, générer automatiquement
        if (!anonymousUsername || !anonymousAvatarUrl) {
            const generated = SubProfile.generateAnonymous()
            anonymousUsername = anonymousUsername || generated.name
            anonymousAvatarUrl = anonymousAvatarUrl || generated.avatar
        }

        // Sanitize
        anonymousUsername = String(anonymousUsername).trim().slice(0, 20)
        if (!anonymousUsername) return res.status(400).json({ error: "Pseudo requis." })

        const sub = await SubProfile.create({
            userId: req.session.user.id,
            anonymousUsername,
            anonymousAvatarUrl
        })
        res.json({ success: true, subProfile: sub })
    } catch (err) {
        res.status(500).json({ error: "Erreur serveur." })
    }
})

// Lister mes sous-profils
router.get("/api/subprofiles", requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id).select("activeSubProfile")
        const subs = await SubProfile.find({ userId: req.session.user.id }).sort({ createdAt: 1 })
        const activeId = user.activeSubProfile?.toString()
        const result = subs.map(sp => ({
            ...sp.toObject(),
            isActive: sp._id.toString() === activeId
        }))
        res.json({ subProfiles: result })
    } catch (err) {
        res.status(500).json({ error: "Erreur serveur." })
    }
})

// Modifier un sous-profil (nom + avatar)
router.put("/api/subprofiles/:id", requireAuth, async (req, res) => {
    try {
        const sub = await SubProfile.findOne({ _id: req.params.id, userId: req.session.user.id })
        if (!sub) return res.status(404).json({ error: "Sous-profil introuvable." })

        const { anonymousUsername, anonymousAvatarUrl } = req.body
        if (anonymousUsername) sub.anonymousUsername = String(anonymousUsername).trim().slice(0, 20)
        if (anonymousAvatarUrl) sub.anonymousAvatarUrl = anonymousAvatarUrl
        await sub.save()

        const user = await User.findById(req.session.user.id).select("activeSubProfile")
        res.json({
            success: true,
            subProfile: {
                ...sub.toObject(),
                isActive: user.activeSubProfile?.toString() === sub._id.toString()
            }
        })
    } catch (err) {
        res.status(500).json({ error: "Erreur serveur." })
    }
})

// Activer / désactiver un sous-profil
router.post("/api/subprofiles/:id/activate", requireAuth, async (req, res) => {
    try {
        const sub = await SubProfile.findOne({ _id: req.params.id, userId: req.session.user.id })
        if (!sub) return res.status(404).json({ error: "Sous-profil introuvable." })
        const user = await User.findById(req.session.user.id)
        if (user.activeSubProfile?.toString() === sub._id.toString()) {
            user.activeSubProfile = null
            await user.save()
            return res.json({ success: true, active: false })
        }
        user.activeSubProfile = sub._id
        await user.save()
        res.json({ success: true, active: true, subProfile: sub })
    } catch (err) {
        res.status(500).json({ error: "Erreur serveur." })
    }
})

// Supprimer un sous-profil
router.delete("/api/subprofiles/:id", requireAuth, async (req, res) => {
    try {
        await SubProfile.deleteOne({ _id: req.params.id, userId: req.session.user.id })
        const user = await User.findById(req.session.user.id)
        if (user.activeSubProfile?.toString() === req.params.id) {
            user.activeSubProfile = null
            await user.save()
        }
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: "Erreur serveur." })
    }
})

module.exports = router
