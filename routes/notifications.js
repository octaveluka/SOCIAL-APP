const express = require("express")
const router = express.Router()
const Notification = require("../models/Notification")
const { requireAuth } = require("../middleware/auth")

router.get("/notifications", requireAuth, async (req, res) => {
    try {
        const notifications = await Notification.find({
            destinataire: req.session.user.id
        })
        .populate("expediteur", "nom photoProfil badges")
        .sort({ createdAt: -1 })
        .limit(50)

        await Notification.updateMany(
            { destinataire: req.session.user.id, lu: false },
            { lu: true }
        )

        res.render("notifications", {
            title: "Notifications",
            currentPage: "notifications",
            notifications
        })
    } catch (err) {
        console.error("Erreur notifications :", err)
        req.flash("error", "Erreur lors du chargement des notifications.")
        res.redirect("/")
    }
})

module.exports = router
