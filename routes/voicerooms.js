const express = require("express")
const router = express.Router()
const { requireAuth } = require("../middleware/auth")
const Group = require("../models/Group")
const User = require("../models/User")

// Rejoindre le salon vocal d'un groupe
router.post("/api/groups/:id/voice/join", requireAuth, async (req, res) => {
    try {
        const group = await Group.findById(req.params.id)
        if (!group) return res.status(404).json({ error: "Groupe introuvable." })
        const userId = req.session.user.id
        const isMember = group.membres.some(m => m.user.toString() === userId)
        if (!isMember) return res.status(403).json({ error: "Non membre." })
        if (!group.voiceRoomMembers.includes(userId)) {
            group.voiceRoomMembers.push(userId)
            group.voiceRoomActive = true
            await group.save()
        }
        const members = await User.find({ _id: { $in: group.voiceRoomMembers } }, "nom photoProfil")
        if (global.io) {
            global.io.to("group_" + group._id).emit("voice-room-update", {
                groupId: group._id,
                members: members.map(m => ({ id: m._id, nom: m.nom, photo: m.photoProfil })),
                action: "join",
                userId
            })
        }
        res.json({ success: true, members })
    } catch (err) {
        res.status(500).json({ error: "Erreur serveur." })
    }
})

// Quitter le salon vocal
router.post("/api/groups/:id/voice/leave", requireAuth, async (req, res) => {
    try {
        const group = await Group.findById(req.params.id)
        if (!group) return res.status(404).json({ error: "Groupe introuvable." })
        const userId = req.session.user.id
        group.voiceRoomMembers = group.voiceRoomMembers.filter(m => m.toString() !== userId)
        if (group.voiceRoomMembers.length === 0) group.voiceRoomActive = false
        await group.save()
        if (global.io) {
            global.io.to("group_" + group._id).emit("voice-room-update", {
                groupId: group._id,
                members: [],
                action: "leave",
                userId
            })
        }
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: "Erreur serveur." })
    }
})

// Récupérer les membres actuels du salon vocal
router.get("/api/groups/:id/voice/members", requireAuth, async (req, res) => {
    try {
        const group = await Group.findById(req.params.id).populate("voiceRoomMembers", "nom photoProfil")
        if (!group) return res.status(404).json({ error: "Groupe introuvable." })
        res.json({ members: group.voiceRoomMembers, active: group.voiceRoomActive })
    } catch (err) {
        res.status(500).json({ error: "Erreur serveur." })
    }
})

module.exports = router
