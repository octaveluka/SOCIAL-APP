const express = require("express")
const router = express.Router()
const crypto = require("crypto")
const Group = require("../models/Group")
const Message = require("../models/Message")
const User = require("../models/User")
const { requireAuth } = require("../middleware/auth")
const { uploadGroup } = require("../lib/cloudinary")

function genererCode() {
    return crypto.randomBytes(6).toString("hex")
}

// Page de création de groupe
router.get("/groups/new", requireAuth, async (req, res) => {
    try {
        const currentUser = await User.findById(req.session.user.id).populate("amis", "nom photoProfil enLigne")
        res.render("new-group", {
            title: "Nouveau groupe",
            currentPage: "messages",
            amis: currentUser.amis
        })
    } catch (err) {
        console.error(err)
        res.redirect("/messages")
    }
})

// Créer un groupe (AJAX)
router.post("/groups/new", requireAuth, async (req, res) => {
    try {
        const { nom, membres } = req.body
        const currentUserId = req.session.user.id

        if (!nom || nom.trim().length === 0) {
            return res.status(400).json({ error: "Le nom du groupe est requis." })
        }

        let membresIds = []
        if (membres) {
            membresIds = Array.isArray(membres) ? membres : [membres]
        }

        const listeMembres = [{ user: currentUserId, isAdmin: true }]
        membresIds.forEach(id => {
            if (id !== currentUserId) {
                listeMembres.push({ user: id, isAdmin: false })
            }
        })

        const group = await Group.create({
            nom: nom.trim(),
            createur: currentUserId,
            membres: listeMembres,
            inviteCode: genererCode()
        })

        res.json({ success: true, groupId: group._id })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Erreur lors de la création du groupe." })
    }
})

// Rejoindre un groupe via lien d'invitation
router.get("/groups/join/:code", requireAuth, async (req, res) => {
    try {
        const group = await Group.findOne({ inviteCode: req.params.code })
        if (!group) {
            req.flash("error", "Lien d'invitation invalide.")
            return res.redirect("/messages")
        }

        const currentUserId = req.session.user.id
        const dejaMembre = group.membres.some(m => m.user.toString() === currentUserId)

        if (!dejaMembre) {
            group.membres.push({ user: currentUserId, isAdmin: false })
            await group.save()
            req.flash("success", `Tu as rejoint le groupe "${group.nom}" !`)
        }

        res.redirect("/groups/" + group._id)
    } catch (err) {
        console.error(err)
        res.redirect("/messages")
    }
})

// Page du groupe (chat) avec badges chargés
router.get("/groups/:id", requireAuth, async (req, res) => {
    try {
        const group = await Group.findById(req.params.id)
            .populate("membres.user", "nom photoProfil enLigne badges")

        if (!group) {
            req.flash("error", "Groupe introuvable.")
            return res.redirect("/messages")
        }

        // Vérifier expiration salon éphémère
        if (group.isEphemeral && group.expiresAt && new Date() > group.expiresAt) {
            await Message.deleteMany({ groupe: group._id })
            await Group.findByIdAndDelete(group._id)
            req.flash("error", "Ce salon éphémère a expiré et a été supprimé.")
            return res.redirect("/messages")
        }

        const currentUserId = req.session.user.id

        // Toujours lire le rôle depuis la DB (pas la session) pour éviter staleness
        const currentUserFromDb = await User.findById(currentUserId, "role nom photoProfil")
        const isSiteAdmin = currentUserFromDb?.role === "admin"

        let membre = group.membres.find(m => m.user && m.user._id && m.user._id.toString() === currentUserId)

        // Les admins du site peuvent accéder à tous les groupes
        if (!membre && isSiteAdmin) {
            await Group.findByIdAndUpdate(group._id, { $push: { membres: { user: currentUserId, isAdmin: true } } })
            membre = { user: { _id: currentUserId }, isAdmin: true }
        }

        if (!membre) {
            req.flash("error", "Tu n'es pas membre de ce groupe.")
            return res.redirect("/messages")
        }

        const messages = await Message.find({ groupe: group._id })
            .populate("expediteur", "nom photoProfil badges")
            .populate("repondA")
            .sort({ createdAt: 1 })

        const pseudoMap = {}
        group.membres.forEach(m => {
            if (m.user && m.user._id) {
                pseudoMap[m.user._id.toString()] = m.pseudo || m.user.nom
            }
        })

        // Admin du site = toujours admin dans le groupe
        const isAdmin = isSiteAdmin || membre.isAdmin

        res.render("group-chat", {
            title: group.nom,
            currentPage: "messages",
            group,
            messages,
            currentUserId,
            isAdmin,
            isSiteAdmin,
            pseudoMap
        })
    } catch (err) {
        console.error(err)
        res.redirect("/messages")
    }
})

// Page paramètres du groupe
router.get("/groups/:id/settings", requireAuth, async (req, res) => {
    try {
        const group = await Group.findById(req.params.id)
            .populate("membres.user", "nom photoProfil badges")

        if (!group) {
            req.flash("error", "Groupe introuvable.")
            return res.redirect("/messages")
        }

        const currentUserId = req.session.user.id
        const membre = group.membres.find(m => m.user._id.toString() === currentUserId)

        if (!membre) {
            req.flash("error", "Tu n'es pas membre de ce groupe.")
            return res.redirect("/messages")
        }

        res.render("group-settings", {
            title: "Paramètres — " + group.nom,
            currentPage: "messages",
            group,
            currentUserId,
            isAdmin: membre.isAdmin,
            isCreator: group.createur.toString() === currentUserId,
            req
        })
    } catch (err) {
        console.error(err)
        res.redirect("/messages")
    }
})

// Modifier la photo du groupe (AJAX) — Cloudinary
router.post("/groups/:id/photo", requireAuth, uploadGroup.single("photo"), async (req, res) => {
    try {
        const group = await Group.findById(req.params.id)
        if (!group) return res.status(404).json({ error: "Groupe introuvable" })

        const currentUserId = req.session.user.id
        const membre = group.membres.find(m => m.user.toString() === currentUserId)

        if (!membre || !membre.isAdmin) {
            return res.status(403).json({ error: "Seuls les admins peuvent modifier la photo." })
        }

        if (!req.file) {
            return res.status(400).json({ error: "Aucune image fournie." })
        }

        group.photo = req.file.path
        await group.save()

        res.json({ success: true, photo: group.photo })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

// Définir son pseudo dans le groupe (AJAX)
router.post("/groups/:id/pseudo", requireAuth, async (req, res) => {
    try {
        const { pseudo } = req.body
        const group = await Group.findById(req.params.id)
        if (!group) return res.status(404).json({ error: "Groupe introuvable" })

        const currentUserId = req.session.user.id
        const membre = group.membres.find(m => m.user.toString() === currentUserId)

        if (!membre) {
            return res.status(403).json({ error: "Tu n'es pas membre de ce groupe." })
        }

        membre.pseudo = pseudo && pseudo.trim().length > 0 ? pseudo.trim() : null
        await group.save()

        res.json({ success: true, pseudo: membre.pseudo })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

// Promouvoir / rétrograder un admin (AJAX)
router.post("/groups/:id/toggle-admin/:userId", requireAuth, async (req, res) => {
    try {
        const group = await Group.findById(req.params.id)
        if (!group) return res.status(404).json({ error: "Groupe introuvable" })

        const currentUserId = req.session.user.id
        const currentMembre = group.membres.find(m => m.user.toString() === currentUserId)

        if (!currentMembre || !currentMembre.isAdmin) {
            return res.status(403).json({ error: "Seuls les administrateurs peuvent faire ça." })
        }

        const targetMembre = group.membres.find(m => m.user.toString() === req.params.userId)
        if (!targetMembre) return res.status(404).json({ error: "Membre introuvable" })

        if (group.createur.toString() === req.params.userId) {
            return res.status(400).json({ error: "Impossible de modifier le statut du créateur." })
        }

        targetMembre.isAdmin = !targetMembre.isAdmin
        await group.save()

        res.json({ success: true, isAdmin: targetMembre.isAdmin })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

// Exclure un membre (AJAX)
router.post("/groups/:id/kick/:userId", requireAuth, async (req, res) => {
    try {
        const group = await Group.findById(req.params.id)
        if (!group) return res.status(404).json({ error: "Groupe introuvable" })

        const currentUserId = req.session.user.id
        const currentMembre = group.membres.find(m => m.user.toString() === currentUserId)

        if (!currentMembre || !currentMembre.isAdmin) {
            return res.status(403).json({ error: "Seuls les administrateurs peuvent exclure des membres." })
        }

        if (group.createur.toString() === req.params.userId) {
            return res.status(400).json({ error: "Impossible d'exclure le créateur du groupe." })
        }

        if (req.params.userId === currentUserId) {
            return res.status(400).json({ error: "Utilise 'Quitter le groupe' pour partir." })
        }

        group.membres = group.membres.filter(m => m.user.toString() !== req.params.userId)
        await group.save()

        res.json({ success: true })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

// Quitter le groupe (AJAX)
router.post("/groups/:id/leave", requireAuth, async (req, res) => {
    try {
        const group = await Group.findById(req.params.id)
        if (!group) return res.status(404).json({ error: "Groupe introuvable" })

        const currentUserId = req.session.user.id

        if (group.createur.toString() === currentUserId) {
            const autresMembres = group.membres.filter(m => m.user.toString() !== currentUserId)

            if (autresMembres.length === 0) {
                await Group.findByIdAndDelete(group._id)
                await Message.deleteMany({ groupe: group._id })
                return res.json({ success: true, deleted: true })
            }

            let nouveauCreateur = autresMembres.find(m => m.isAdmin)
            if (!nouveauCreateur) {
                nouveauCreateur = autresMembres[0]
                nouveauCreateur.isAdmin = true
            }

            group.createur = nouveauCreateur.user
        }

        group.membres = group.membres.filter(m => m.user.toString() !== currentUserId)
        await group.save()

        res.json({ success: true, deleted: false })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

// Régénérer le lien d'invitation (AJAX)
router.post("/groups/:id/regenerate-link", requireAuth, async (req, res) => {
    try {
        const group = await Group.findById(req.params.id)
        if (!group) return res.status(404).json({ error: "Groupe introuvable" })

        const currentUserId = req.session.user.id
        const currentMembre = group.membres.find(m => m.user.toString() === currentUserId)

        if (!currentMembre || !currentMembre.isAdmin) {
            return res.status(403).json({ error: "Seuls les administrateurs peuvent régénérer le lien." })
        }

        group.inviteCode = genererCode()
        await group.save()

        res.json({ success: true, inviteCode: group.inviteCode })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

// =============================================
// SALONS ÉPHÉMÈRES
// =============================================

router.get("/salons/new", requireAuth, async (req, res) => {
    try {
        const currentUser = await User.findById(req.session.user.id).populate("amis", "nom photoProfil enLigne")
        res.render("new-salon", {
            title: "Nouveau salon éphémère",
            currentPage: "messages",
            amis: currentUser.amis
        })
    } catch (err) {
        console.error(err)
        res.redirect("/messages")
    }
})

router.post("/salons/new", requireAuth, async (req, res) => {
    try {
        const { nom, membres, dureeHeures } = req.body
        const currentUserId = req.session.user.id

        if (!nom || nom.trim().length === 0) {
            return res.status(400).json({ error: "Le nom du salon est requis." })
        }

        const heures = Math.max(1, Math.min(168, parseInt(dureeHeures) || 24))
        const expiresAt = new Date(Date.now() + heures * 3600 * 1000)

        let membresIds = []
        if (membres) {
            membresIds = Array.isArray(membres) ? membres : [membres]
        }

        const listeMembres = [{ user: currentUserId, isAdmin: true }]
        membresIds.forEach(id => {
            if (id !== currentUserId) listeMembres.push({ user: id, isAdmin: false })
        })

        const group = await Group.create({
            nom: nom.trim(),
            createur: currentUserId,
            membres: listeMembres,
            inviteCode: genererCode(),
            isEphemeral: true,
            expiresAt
        })

        res.json({ success: true, groupId: group._id })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Erreur lors de la création du salon." })
    }
})

module.exports = router
