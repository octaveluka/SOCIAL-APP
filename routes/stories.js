const express = require("express")
const router = express.Router()
const Story = require("../models/Story")
const User = require("../models/User")
const Notification = require("../models/Notification")
const { requireAuth } = require("../middleware/auth")
const { uploadStory } = require("../lib/cloudinary")
const { track } = require("../lib/analytics") // ← AJOUT

// Récupérer les stories du feed (amis + soi-même)
router.get("/stories", requireAuth, async (req, res) => {
    try {
        const currentUser = await User.findById(req.session.user.id)
        const idsAVoir = [currentUser._id, ...currentUser.amis]

        const stories = await Story.find({
            auteur: { $in: idsAVoir },
            expiresAt: { $gt: new Date() }
        })
        .populate("auteur", "nom photoProfil")
        .sort({ createdAt: -1 })

        // Grouper par auteur
        const grouped = {}
        stories.forEach(story => {
            const uid = story.auteur._id.toString()
            if (!grouped[uid]) {
                grouped[uid] = {
                    user: story.auteur,
                    stories: [],
                    hasUnseen: false
                }
            }
            const seen = story.vues.some(v => v.user.toString() === req.session.user.id)
            if (!seen) grouped[uid].hasUnseen = true
            grouped[uid].stories.push(story)
        })

        res.json({ success: true, groups: Object.values(grouped) })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

// Créer une story avec média
router.post("/stories", requireAuth, uploadStory.single("media"), async (req, res) => {
    try {
        const { texte, couleurFond } = req.body

        if (!req.file && !couleurFond) {
            return res.status(400).json({ error: "Média ou couleur de fond requis." })
        }

        const isVideo = req.file?.mimetype?.startsWith("video/")

        const story = await Story.create({
            auteur: req.session.user.id,
            media: req.file?.path || null,
            mediaType: isVideo ? "video" : "image",
            texte: texte?.trim() || "",
            couleurFond: !req.file ? (couleurFond || "#4f46e5") : null,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        })

        await story.populate("auteur", "nom photoProfil")

        // XP pour story créée
        await User.findByIdAndUpdate(req.session.user.id, { $inc: { xp: 5 } })

        // =============================================
        // === ORACLE / ANALYTICS : tracker STORY ===
        // =============================================
        await track(req.session.user.id, 'STORY')

        res.json({ success: true, story })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Erreur lors de la création de la story." })
    }
})

// Créer une story texte (fond coloré sans média)
router.post("/stories/text", requireAuth, async (req, res) => {
    try {
        const { texte, couleurFond } = req.body

        if (!texte || texte.trim().length === 0) {
            return res.status(400).json({ error: "Le texte est requis." })
        }

        const story = await Story.create({
            auteur: req.session.user.id,
            media: `https://ui-avatars.com/api/?background=${(couleurFond || "#4f46e5").replace("#", "")}&color=fff&name=S&size=1080`,
            mediaType: "image",
            texte: texte.trim(),
            couleurFond: couleurFond || "#4f46e5",
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        })

        await story.populate("auteur", "nom photoProfil")
        await User.findByIdAndUpdate(req.session.user.id, { $inc: { xp: 3 } })

        // =============================================
        // === ORACLE / ANALYTICS : tracker STORY ===
        // =============================================
        await track(req.session.user.id, 'STORY')

        res.json({ success: true, story })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

// Marquer une story comme vue
router.post("/stories/:id/view", requireAuth, async (req, res) => {
    try {
        const story = await Story.findById(req.params.id)
        if (!story) return res.status(404).json({ error: "Story introuvable" })

        const alreadySeen = story.vues.some(v => v.user.toString() === req.session.user.id)
        if (!alreadySeen) {
            story.vues.push({ user: req.session.user.id })
            await story.save()
        }

        res.json({ success: true, views: story.vues.length })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

// Réagir à une story
router.post("/stories/:id/react", requireAuth, async (req, res) => {
    try {
        const { emoji } = req.body
        if (!emoji) return res.status(400).json({ error: "Emoji requis" })

        const story = await Story.findById(req.params.id).populate("auteur", "nom")
        if (!story) return res.status(404).json({ error: "Story introuvable" })

        // Une seule réaction par utilisateur
        story.reactions = story.reactions.filter(r => r.user.toString() !== req.session.user.id)
        story.reactions.push({ user: req.session.user.id, emoji })
        await story.save()

        // Notification à l'auteur
        if (story.auteur._id.toString() !== req.session.user.id) {
            await Notification.create({
                destinataire: story.auteur._id,
                expediteur: req.session.user.id,
                type: "like",
                lien: "/"
            })

            if (global.io) {
                global.io.to(story.auteur._id.toString()).emit("story-reaction", {
                    storyId: story._id,
                    emoji,
                    from: req.session.user.id
                })
            }
        }

        res.json({ success: true, reactions: story.reactions.length })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

// Voir qui a vu une story (auteur uniquement)
router.get("/stories/:id/viewers", requireAuth, async (req, res) => {
    try {
        const story = await Story.findById(req.params.id)
            .populate("vues.user", "nom photoProfil")
        if (!story) return res.status(404).json({ error: "Story introuvable" })
        if (story.auteur.toString() !== req.session.user.id) {
            return res.json({ success: true, viewers: [], restricted: true })
        }
        res.json({ success: true, viewers: story.vues, restricted: false })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

// Supprimer sa propre story
router.delete("/stories/:id", requireAuth, async (req, res) => {
    try {
        const story = await Story.findById(req.params.id)
        if (!story) return res.status(404).json({ error: "Story introuvable" })

        if (story.auteur.toString() !== req.session.user.id) {
            return res.status(403).json({ error: "Tu ne peux pas supprimer cette story." })
        }

        await Story.findByIdAndDelete(story._id)
        res.json({ success: true })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

// Voir les stories d'un utilisateur spécifique
router.get("/stories/user/:userId", requireAuth, async (req, res) => {
    try {
        const currentUserId = req.session.user.id
        const targetId = req.params.userId

        // FIX-15: accès autorisé uniquement pour ses propres stories ou celles de ses amis
        if (currentUserId !== targetId) {
            const currentUser = await User.findById(currentUserId, "amis role")
            const isFriend = currentUser?.amis?.some(a => a.toString() === targetId)
            const isSiteAdmin = currentUser?.role === "admin"
            if (!isFriend && !isSiteAdmin) {
                return res.status(403).json({ error: "Accès non autorisé aux stories de cet utilisateur." })
            }
        }

        const stories = await Story.find({
            auteur: targetId,
            expiresAt: { $gt: new Date() }
        })
        .populate("auteur", "nom photoProfil")
        .populate("vues.user", "nom photoProfil")
        .sort({ createdAt: 1 })

        res.json({ success: true, stories })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

module.exports = router
