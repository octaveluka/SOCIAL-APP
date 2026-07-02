const express = require("express")
const router = express.Router()
const User = require("../models/User")
const Notification = require("../models/Notification")
const { requireAuth } = require("../middleware/auth")
const { sendPushToUser, buildPayload } = require("../lib/webpush")

// Page Amis — demandes reçues + liste d'amis
router.get("/friends", requireAuth, async (req, res) => {
    try {
        const currentUser = await User.findById(req.session.user.id)
            .populate("amis", "nom photoProfil bio")
            .populate("demandesRecues", "nom photoProfil bio")
            .populate("demandesEnvoyees", "nom photoProfil bio")

        const demandesCount = currentUser.demandesRecues.length

        res.render("friends", {
            title: "Amis",
            currentPage: "friends",
            amis: currentUser.amis,
            demandesRecues: currentUser.demandesRecues,
            demandesEnvoyees: currentUser.demandesEnvoyees,
            demandesCount
        })
    } catch (err) {
        console.error(err)
        res.redirect("/")
    }
})

// Recherche d'utilisateurs + suggestions par défaut
router.get("/search", requireAuth, async (req, res) => {
    try {
        const { q } = req.query
        const currentUser = await User.findById(req.session.user.id)

        let resultats = []
        let suggestions = []

        if (q && q.trim().length > 0) {
            const escapedQ = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            resultats = await User.find({
                nom: { $regex: escapedQ, $options: "i" },
                _id: { $ne: currentUser._id }
            }).limit(20)
        } else {
            suggestions = await User.find({ _id: { $ne: currentUser._id } })
                .sort({ createdAt: -1 })
                .limit(10)
        }

        const demandesCount = currentUser.demandesRecues.length

        res.render("search", {
            title: "Rechercher",
            currentPage: "search",
            resultats,
            suggestions,
            query: q || "",
            currentUser,
            demandesCount
        })
    } catch (err) {
        console.error(err)
        res.redirect("/")
    }
})

// Envoyer une demande d'ami
router.post("/friends/request/:id", requireAuth, async (req, res) => {
    try {
        const targetId = req.params.id
        const currentUser = await User.findById(req.session.user.id)
        const targetUser = await User.findById(targetId)

        if (!targetUser) {
            req.flash("error", "Utilisateur introuvable.")
            return res.redirect("/")
        }

        if (targetId === currentUser._id.toString()) {
            return res.redirect("/")
        }

        const alreadyFriend = currentUser.amis.some(id => id.toString() === targetId)
        const alreadySent = currentUser.demandesEnvoyees.some(id => id.toString() === targetId)

        if (alreadyFriend || alreadySent) {
            return res.redirect(req.headers.referer || "/")
        }

        currentUser.demandesEnvoyees.push(targetId)
        targetUser.demandesRecues.push(currentUser._id)

        await currentUser.save()
        await targetUser.save()

        const notification = await Notification.create({
            destinataire: targetUser._id,
            expediteur: currentUser._id,
            type: "demande_ami",
            lien: "/friends"
        })

        if (global.io) {
            global.io.emit('notification', notification)
        }

        sendPushToUser(targetUser._id.toString(), buildPayload("friend-request", {
            senderName: currentUser.nom,
            senderId: currentUser._id.toString()
        })).catch(() => {})

        req.flash("success", "Demande d'ami envoyée !")
        res.redirect(req.headers.referer || "/")
    } catch (err) {
        console.error(err)
        res.redirect("/")
    }
})

// Annuler une demande envoyée
router.post("/friends/cancel/:id", requireAuth, async (req, res) => {
    try {
        const targetId = req.params.id
        const currentUser = await User.findById(req.session.user.id)
        const targetUser = await User.findById(targetId)

        if (!targetUser) return res.redirect("/")

        currentUser.demandesEnvoyees = currentUser.demandesEnvoyees.filter(
            id => id.toString() !== targetId
        )
        targetUser.demandesRecues = targetUser.demandesRecues.filter(
            id => id.toString() !== currentUser._id.toString()
        )

        await currentUser.save()
        await targetUser.save()

        req.flash("success", "Demande annulée.")
        res.redirect(req.headers.referer || "/")
    } catch (err) {
        console.error(err)
        res.redirect("/")
    }
})

// Accepter une demande
router.post("/friends/accept/:id", requireAuth, async (req, res) => {
    try {
        const targetId = req.params.id
        const currentUser = await User.findById(req.session.user.id)
        const targetUser = await User.findById(targetId)

        if (!targetUser) return res.redirect("/")

        const hasRequest = currentUser.demandesRecues.some(id => id.toString() === targetId)
        if (!hasRequest) {
            return res.redirect(req.headers.referer || "/")
        }

        currentUser.demandesRecues = currentUser.demandesRecues.filter(
            id => id.toString() !== targetId
        )
        targetUser.demandesEnvoyees = targetUser.demandesEnvoyees.filter(
            id => id.toString() !== currentUser._id.toString()
        )

        currentUser.amis.push(targetId)
        targetUser.amis.push(currentUser._id)

        await currentUser.save()
        await targetUser.save()

        const notification = await Notification.create({
            destinataire: targetUser._id,
            expediteur: currentUser._id,
            type: "ami_accepte",
            lien: "/profile/" + currentUser._id
        })

        if (global.io) {
            global.io.emit('notification', notification)
        }

        sendPushToUser(targetUser._id.toString(), buildPayload("friend-accepted", {
            senderName: currentUser.nom,
            senderId: currentUser._id.toString()
        })).catch(() => {})

        req.flash("success", `Vous êtes maintenant ami avec ${targetUser.nom} !`)
        res.redirect(req.headers.referer || "/friends")
    } catch (err) {
        console.error(err)
        res.redirect("/")
    }
})

// Refuser une demande
router.post("/friends/decline/:id", requireAuth, async (req, res) => {
    try {
        const targetId = req.params.id
        const currentUser = await User.findById(req.session.user.id)
        const targetUser = await User.findById(targetId)

        currentUser.demandesRecues = currentUser.demandesRecues.filter(
            id => id.toString() !== targetId
        )

        if (targetUser) {
            targetUser.demandesEnvoyees = targetUser.demandesEnvoyees.filter(
                id => id.toString() !== currentUser._id.toString()
            )
            await targetUser.save()
        }

        await currentUser.save()

        req.flash("success", "Demande refusée.")
        res.redirect(req.headers.referer || "/friends")
    } catch (err) {
        console.error(err)
        res.redirect("/")
    }
})

// Retirer un ami
router.post("/friends/remove/:id", requireAuth, async (req, res) => {
    try {
        const targetId = req.params.id
        const currentUser = await User.findById(req.session.user.id)
        const targetUser = await User.findById(targetId)

        currentUser.amis = currentUser.amis.filter(id => id.toString() !== targetId)

        if (targetUser) {
            targetUser.amis = targetUser.amis.filter(
                id => id.toString() !== currentUser._id.toString()
            )
            await targetUser.save()
        }

        await currentUser.save()

        req.flash("success", "Ami retiré.")
        res.redirect(req.headers.referer || "/friends")
    } catch (err) {
        console.error(err)
        res.redirect("/")
    }
})

// =============================================
// FOLLOW / UNFOLLOW
// =============================================
router.post("/profile/:id/follow", requireAuth, async (req, res) => {
    try {
        const targetId = req.params.id
        const myId = req.session.user.id
        if (targetId === myId) return res.status(400).json({ error: "Action impossible." })

        const [me, target] = await Promise.all([
            User.findById(myId),
            User.findById(targetId)
        ])
        if (!target) return res.status(404).json({ error: "Utilisateur introuvable." })

        const alreadyFollowing = me.following.some(id => id.toString() === targetId)
        if (alreadyFollowing) return res.json({ success: true, following: true, count: target.followers.length })

        me.following.push(targetId)
        target.followers.push(myId)
        await Promise.all([me.save(), target.save()])

        // Notification
        const notif = await Notification.create({
            destinataire: targetId,
            expediteur: myId,
            type: "abonnement",
            lien: `/profile/${myId}`
        })
        const populated = await notif.populate("expediteur", "nom photoProfil")
        global.io?.to(targetId).emit("new-notification", {
            ...populated.toObject(),
            texte: `${me.nom} a commencé à vous suivre`
        })

        // Push
        try {
            const { sendPushToUser, buildPayload } = require("../lib/webpush")
            await sendPushToUser(targetId, buildPayload(
                "Nouvel abonné",
                `${me.nom} a commencé à vous suivre`,
                `/profile/${myId}`
            ))
        } catch (_) {}

        res.json({ success: true, following: true, count: target.followers.length + 1 })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Erreur serveur." })
    }
})

router.post("/profile/:id/unfollow", requireAuth, async (req, res) => {
    try {
        const targetId = req.params.id
        const myId = req.session.user.id

        const [me, target] = await Promise.all([
            User.findById(myId),
            User.findById(targetId)
        ])
        if (!target) return res.status(404).json({ error: "Utilisateur introuvable." })

        me.following = me.following.filter(id => id.toString() !== targetId)
        target.followers = target.followers.filter(id => id.toString() !== myId)
        await Promise.all([me.save(), target.save()])

        res.json({ success: true, following: false, count: target.followers.length })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Erreur serveur." })
    }
})

module.exports = router
