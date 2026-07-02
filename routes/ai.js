const express = require("express")
const router = express.Router()
const { requireAuth } = require("../middleware/auth")
const { dispatchCommand, handleTranslate } = require("../lib/aiCommands")
const Message = require("../models/Message")

// Route principale : traitement des commandes IA (utilisée via fetch depuis les pages chat)
router.post("/api/ai/command", requireAuth, async (req, res) => {
    try {
        const { text, replyToId, groupId, destinataireId } = req.body
        const senderId = req.session.user.id

        if (!text || !text.trim()) {
            return res.status(400).json({ error: "Commande vide." })
        }

        const result = await dispatchCommand(text, senderId, { replyToId, groupId, destinataireId })

        if (!result) {
            return res.status(400).json({ error: "Commande non reconnue." })
        }

        if (result.error) {
            return res.status(422).json({ error: result.error })
        }

        // Sauvegarder le message en base
        const msgData = {
            expediteur: senderId,
            destinataire: destinataireId || null,
            groupe: groupId || null,
            lu: false
        }

        if (result.type === "text") {
            msgData.contenu = result.content
        } else if (result.type === "image") {
            msgData.image = result.content
            msgData.contenu = result.caption || ""
        } else if (result.type === "sticker") {
            msgData.image = result.content
            msgData.isSticker = true
            msgData.contenu = ""
        } else if (result.type === "burn") {
            msgData.contenu = result.content
            msgData.expiresAt = result.expiresAt
        }

        const saved = await Message.create(msgData)

        // Diffuser via Socket.io
        const payload = {
            _id: saved._id,
            expediteur: senderId,
            destinataire: destinataireId,
            groupe: groupId,
            contenu: msgData.contenu,
            image: msgData.image || null,
            isSticker: msgData.isSticker || false,
            expiresAt: msgData.expiresAt || null,
            burnSeconds: result.burnSeconds || null,
            type: result.type,
            lu: false,
            createdAt: saved.createdAt
        }

        if (global.io) {
            if (destinataireId) {
                global.io.to(destinataireId).emit("new-message", payload)
                global.io.to(senderId).emit("new-message", payload)
            } else if (groupId) {
                // Charger le pseudo
                const User = require("../models/User")
                const user = await User.findById(senderId)
                payload.pseudo = user?.nom || "?"
                payload.expediteur = { _id: senderId, nom: user?.nom }
                payload.groupId = groupId
                global.io.to("group_" + groupId).emit("new-group-message", payload)
            }
        }

        res.json({ success: true, message: payload, result })
    } catch (err) {
        console.error("AI command error:", err)
        res.status(500).json({ error: "Erreur serveur." })
    }
})

// Traduction d'un message
router.post("/api/ai/translate", requireAuth, async (req, res) => {
    try {
        const { text } = req.body
        if (!text) return res.status(400).json({ error: "Texte requis." })
        const result = await handleTranslate(text)
        if (result.error) return res.status(422).json({ error: result.error })
        res.json({ translation: result.content })
    } catch (err) {
        console.error("Translate error:", err)
        res.status(500).json({ error: "Erreur serveur." })
    }
})

module.exports = router
