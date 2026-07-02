const express = require("express")
const router = express.Router()
const PushSubscription = require("../models/PushSubscription")
const { requireAuth } = require("../middleware/auth")

// Envoyer la clé publique VAPID au client
router.get("/push/vapid-key", requireAuth, (req, res) => {
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY })
})

// Enregistrer une subscription push
router.post("/push/subscribe", requireAuth, async (req, res) => {
    try {
        const { endpoint, keys } = req.body

        if (!endpoint || !keys?.p256dh || !keys?.auth) {
            return res.status(400).json({ error: "Données de subscription invalides." })
        }

        const userAgent = req.headers["user-agent"] || ""

        // Upsert — mettre à jour si existe, créer sinon
        await PushSubscription.findOneAndUpdate(
            { endpoint },
            {
                user: req.session.user.id,
                endpoint,
                keys,
                userAgent,
                active: true
            },
            { upsert: true, new: true }
        )

        res.json({ success: true })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Erreur lors de l'enregistrement." })
    }
})

// Désabonner un appareil
router.post("/push/unsubscribe", requireAuth, async (req, res) => {
    try {
        const { endpoint } = req.body

        await PushSubscription.findOneAndUpdate(
            { endpoint, user: req.session.user.id },
            { active: false }
        )

        res.json({ success: true })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Erreur lors du désabonnement." })
    }
})

// Statut des notifications push de l'utilisateur
router.get("/push/status", requireAuth, async (req, res) => {
    try {
        const count = await PushSubscription.countDocuments({
            user: req.session.user.id,
            active: true
        })

        res.json({ subscribed: count > 0, devices: count })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

module.exports = router
