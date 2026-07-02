const express = require("express")
const router = express.Router()
const User = require("../models/User")
const Post = require("../models/Post")
const { requireAuth } = require("../middleware/auth")
const { nomValide } = require("../lib/validation")
const { uploadProfile } = require("../lib/cloudinary")

// Voir un profil
router.get("/profile/:id", requireAuth, async (req, res) => {
    try {
        const profileUser = await User.findById(req.params.id)
        if (!profileUser) {
            req.flash("error", "Utilisateur introuvable.")
            return res.redirect("/")
        }

        const currentUser = await User.findById(req.session.user.id)

        const rawPosts = await Post.find({ auteur: profileUser._id })
            .populate("auteur", "nom photoProfil badges")
            .populate("commentaires.auteur", "nom photoProfil badges")
            .populate({
                path: "sharedFrom",
                populate: { path: "auteur", select: "nom photoProfil badges" }
            })
            .sort({ createdAt: -1 })

        const posts = rawPosts.filter(p => p.auteur != null)

        const isOwnProfile = profileUser._id.toString() === currentUser._id.toString()
        const isFriend = currentUser.amis.some(id => id.toString() === profileUser._id.toString())
        const requestSent = currentUser.demandesEnvoyees.some(id => id.toString() === profileUser._id.toString())
        const requestReceived = currentUser.demandesRecues.some(id => id.toString() === profileUser._id.toString())
        const amisCommuns = profileUser.amis.filter(id =>
            currentUser.amis.some(myId => myId.toString() === id.toString())
        ).length
        const isFollowing = currentUser.following.some(id => id.toString() === profileUser._id.toString())

        res.render("profile", {
            title: profileUser.nom,
            currentPage: "profile",
            profileUser,
            posts,
            currentUserId: currentUser._id.toString(),
            isOwnProfile,
            isFriend,
            requestSent,
            requestReceived,
            amisCommuns,
            isFollowing,
            demandesCount: currentUser.demandesRecues.length
        })
    } catch (err) {
        console.error(err)
        req.flash("error", "Erreur lors du chargement du profil.")
        res.redirect("/")
    }
})

// Modifier le profil — page
router.get("/profile/edit/me", requireAuth, async (req, res) => {
    try {
        const currentUser = await User.findById(req.session.user.id)
        res.render("edit-profile", {
            title: "Modifier le profil",
            currentPage: "profile",
            profileUser: currentUser,
            demandesCount: currentUser.demandesRecues.length
        })
    } catch (err) {
        console.error(err)
        res.redirect("/")
    }
})

// Modifier le profil — traitement
router.post("/profile/edit", requireAuth, uploadProfile.single("photoProfil"), async (req, res) => {
    try {
        const { nom, bio } = req.body
        const currentUser = await User.findById(req.session.user.id)

        if (nom && nom.trim().length > 0) {
            if (!nomValide(nom)) {
                req.flash("error", "Le nom ne doit contenir que des lettres, chiffres, espaces, tirets ou apostrophes.")
                return res.redirect("/profile/edit/me")
            }
            currentUser.nom = nom.trim()
        }

        currentUser.bio = bio ? bio.trim() : ""
        if (req.file) {
            currentUser.photoProfil = req.file.path
        } else if (req.body.avatarUrl) {
            const url = req.body.avatarUrl
            if (url.startsWith("https://api.dicebear.com/")) {
                currentUser.photoProfil = url
            }
        }

        await currentUser.save()

        req.session.user.nom = currentUser.nom
        req.session.user.photoProfil = currentUser.photoProfil

        req.flash("success", "Profil mis à jour avec succès !")
        res.redirect("/profile/" + currentUser._id)
    } catch (err) {
        console.error(err)
        req.flash("error", "Erreur lors de la mise à jour du profil.")
        res.redirect("/profile/edit/me")
    }
})

router.post("/api/profile/cover", requireAuth, async (req, res) => {
    try {
        const { coverUrl } = req.body
        if (!coverUrl || typeof coverUrl !== "string") return res.status(400).json({ error: "URL invalide." })
        const isCssBackground = /^(linear-gradient|radial-gradient)\(/.test(coverUrl)
        const isSolidColor = /^#[0-9a-fA-F]{3,6}$/.test(coverUrl)
        let isAllowed = isCssBackground || isSolidColor
        if (!isAllowed) {
            const allowed = ["picsum.photos", "images.unsplash.com"]
            try { const u = new URL(coverUrl); isAllowed = allowed.some(d => u.hostname.includes(d)) } catch {}
        }
        if (!isAllowed) return res.status(400).json({ error: "Source non autorisée." })
        await User.findByIdAndUpdate(req.session.user.id, { profileCover: coverUrl })
        res.json({ success: true })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Erreur serveur." })
    }
})

module.exports = router
