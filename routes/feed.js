const express = require("express")
const router = express.Router()
const Post = require("../models/Post")
const User = require("../models/User")
const Notification = require("../models/Notification")
const { requireAuth, requireNotRestricted } = require("../middleware/auth")
const { uploadPost } = require("../lib/cloudinary")
const { track } = require("../lib/analytics")
const { sendPushToUser, buildPayload } = require("../lib/webpush")

// Page d'accueil — Feed
router.get("/", requireAuth, async (req, res) => {
    try {
        const currentUser = await User.findById(req.session.user.id)

        // Feed = mes posts + amis + abonnements. Fallback global si < 5 posts.
        const feedUserIds = [
            currentUser._id,
            ...(currentUser.amis || []),
            ...(currentUser.following || [])
        ]

        let rawPosts = await Post.find({ auteur: { $in: feedUserIds } })
            .populate("auteur", "nom photoProfil badges profileEffect")
            .populate("commentaires.auteur", "nom photoProfil badges profileEffect")
            .populate({
                path: "sharedFrom",
                populate: { path: "auteur", select: "nom photoProfil badges" }
            })
            .sort({ createdAt: -1 })
            .limit(50)

        if (rawPosts.filter(p => p.auteur != null).length < 5) {
            rawPosts = await Post.find()
                .populate("auteur", "nom photoProfil badges profileEffect")
                .populate("commentaires.auteur", "nom photoProfil badges profileEffect")
                .populate({
                    path: "sharedFrom",
                    populate: { path: "auteur", select: "nom photoProfil badges" }
                })
                .sort({ createdAt: -1 })
                .limit(50)
        }

        const posts = rawPosts.filter(p => p.auteur != null)
        const demandesCount = currentUser.demandesRecues.length

        res.render("feed", {
            title: "Accueil",
            currentPage: "feed",
            posts,
            currentUserId: currentUser._id.toString(),
            demandesCount
        })
    } catch (err) {
        console.error(err)
        res.send("❌ Erreur lors du chargement du feed")
    }
})

// Publier un post
router.post("/post", requireAuth, requireNotRestricted("posts"), uploadPost.single("image"), async (req, res) => {
    try {
        const { contenu } = req.body

        if (!contenu || contenu.trim().length === 0) {
            req.flash("error", "Le contenu ne peut pas être vide.")
            return res.redirect("/")
        }
        // FIX-16: limiter la longueur du contenu d'une publication
        if (contenu.trim().length > 3000) {
            req.flash("error", "Le contenu ne peut pas dépasser 3000 caractères.")
            return res.redirect("/")
        }

        const newPost = new Post({
            auteur: req.session.user.id,
            contenu: contenu.trim().slice(0, 3000),
            image: req.file ? req.file.path : null
        })

        await newPost.save()

        // =============================================
        // === ORACLE / ANALYTICS : tracker POST ===
        // =============================================
        await track(req.session.user.id, 'POST')

        // Diffuser le nouveau post en temps réel à tous les utilisateurs connectés
        if (global.io) {
            try {
                const populated = await Post.findById(newPost._id)
                    .populate("auteur", "nom photoProfil badges profileEffect")
                global.io.emit("new-post", populated)
            } catch (e) { console.error("Socket new-post:", e.message) }
        }

        res.redirect("/")
    } catch (err) {
        console.error(err)
        req.flash("error", "Erreur lors de la publication.")
        res.redirect("/")
    }
})

// Supprimer un post
router.post("/post/:id/delete", requireAuth, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id)

        if (!post) return res.redirect("/")

        if (post.auteur.toString() !== req.session.user.id) {
            req.flash("error", "Tu ne peux pas supprimer ce post.")
            return res.redirect("/")
        }

        await Post.findByIdAndDelete(req.params.id)
        res.redirect("/")
    } catch (err) {
        console.error(err)
        res.redirect("/")
    }
})

// Like / Unlike un post (AJAX)
router.post("/post/:id/like", requireAuth, requireNotRestricted("likes"), async (req, res) => {
    try {
        const post = await Post.findById(req.params.id)
        if (!post) return res.status(404).json({ error: "Post introuvable" })

        const userId = req.session.user.id
        const alreadyLiked = post.likes.some(id => id.toString() === userId)

        if (alreadyLiked) {
            post.likes = post.likes.filter(id => id.toString() !== userId)
        } else {
            post.likes.push(userId)

            if (post.auteur.toString() !== userId) {
                const notification = await Notification.create({
                    destinataire: post.auteur,
                    expediteur: userId,
                    type: "like",
                    lien: "/"
                })
                if (global.io) {
                    const notifComplete = await Notification.findById(notification._id)
                        .populate("expediteur", "nom photoProfil")
                    global.io.to(post.auteur.toString()).emit("notification", notifComplete)
                }
                const liker = await User.findById(userId, "nom")
                sendPushToUser(post.auteur.toString(), buildPayload("like", {
                    senderName: liker?.nom || "Quelqu'un",
                    senderId: userId,
                    content: post.contenu
                })).catch(() => {})
            }
        }

        await post.save()

        // =============================================
        // === ORACLE / ANALYTICS : tracker LIKE ===
        // =============================================
        await track(userId, 'LIKE')

        res.json({
            success: true,
            likesCount: post.likes.length,
            liked: !alreadyLiked
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

// Réagir à un post (long-press reactions)
router.post("/post/:id/react", requireAuth, requireNotRestricted("likes"), async (req, res) => {
    try {
        const { type } = req.body
        const validTypes = ["heart", "haha", "wow", "sad", "clap", "grr"]
        if (!validTypes.includes(type)) return res.status(400).json({ error: "Type invalide" })

        const post = await Post.findById(req.params.id)
        if (!post) return res.status(404).json({ error: "Post introuvable" })

        const userId = req.session.user.id
        const existingIdx = post.reactions.findIndex(r => r.user.toString() === userId)
        const existingType = existingIdx !== -1 ? post.reactions[existingIdx].type : null

        if (existingType === type) {
            // Même réaction → retirer
            post.reactions.splice(existingIdx, 1)
            post.likes = post.likes.filter(id => id.toString() !== userId)
        } else {
            // Nouvelle réaction ou changement
            if (existingIdx !== -1) post.reactions.splice(existingIdx, 1)
            post.reactions.push({ user: userId, type })
            if (!post.likes.some(id => id.toString() === userId)) post.likes.push(userId)

            if (post.auteur.toString() !== userId) {
                const notification = await Notification.create({
                    destinataire: post.auteur,
                    expediteur: userId,
                    type: "like",
                    lien: "/"
                })
                if (global.io) {
                    const notifComplete = await Notification.findById(notification._id)
                        .populate("expediteur", "nom photoProfil")
                    global.io.to(post.auteur.toString()).emit("notification", notifComplete)
                }
                const reactor = await User.findById(userId, "nom")
                const labels = { heart: "❤️", haha: "😂", wow: "😮", sad: "😢", clap: "👏", grr: "😠" }
                sendPushToUser(post.auteur.toString(), buildPayload("like", {
                    senderName: reactor?.nom || "Quelqu'un",
                    senderId: userId,
                    content: `${labels[type]} ${post.contenu}`
                })).catch(() => {})
            }
        }

        await post.save()
        await track(userId, "LIKE")

        res.json({
            success: true,
            reactionsCount: post.likes.length,
            userReaction: existingType === type ? null : type
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

// Ajouter un commentaire (AJAX)
router.post("/post/:id/comment", requireAuth, requireNotRestricted("messages"), async (req, res) => {
    try {
        const { texte, replyTo, mentionIds } = req.body
        if (!texte || texte.trim().length === 0) {
            return res.status(400).json({ error: "Commentaire vide" })
        }

        const post = await Post.findById(req.params.id)
        if (!post) return res.status(404).json({ error: "Post introuvable" })

        const userId = req.session.user.id
        const commentData = { auteur: userId, texte: texte.trim() }
        if (replyTo && replyTo.userId && replyTo.nom) {
            commentData.replyTo = { userId: replyTo.userId, nom: replyTo.nom }
        }

        post.commentaires.push(commentData)
        await post.save()

        const currentUser = await User.findById(userId)
        const newComment = post.commentaires[post.commentaires.length - 1]

        // Notif: réponse à un commentaire
        if (replyTo && replyTo.userId && replyTo.userId !== userId) {
            const notif = await Notification.create({
                destinataire: replyTo.userId, expediteur: userId, type: "reponse", lien: "/"
            })
            if (global.io) {
                const n = await Notification.findById(notif._id).populate("expediteur", "nom photoProfil")
                global.io.to(replyTo.userId.toString()).emit("notification", n)
            }
        }

        // Notif: auteur du post (si pas déjà notifié via réponse)
        const alreadyNotified = replyTo && replyTo.userId && replyTo.userId === post.auteur.toString()
        if (post.auteur.toString() !== userId && !alreadyNotified) {
            const notification = await Notification.create({
                destinataire: post.auteur, expediteur: userId, type: "commentaire", lien: "/"
            })
            if (global.io) {
                const notifComplete = await Notification.findById(notification._id)
                    .populate("expediteur", "nom photoProfil")
                global.io.to(post.auteur.toString()).emit("notification", notifComplete)
            }
            sendPushToUser(post.auteur.toString(), buildPayload("comment", {
                senderName: currentUser?.nom || "Quelqu'un",
                senderId: userId,
                content: texte.trim()
            })).catch(() => {})
        }

        // Notif: mentions @
        if (Array.isArray(mentionIds)) {
            for (const mId of mentionIds) {
                if (mId === userId) continue
                await Notification.create({
                    destinataire: mId, expediteur: userId, type: "mention", lien: "/"
                }).catch(() => {})
            }
        }

        await track(userId, 'COMMENT')

        res.json({
            success: true,
            commentsCount: post.commentaires.length,
            comment: {
                _id: newComment._id,
                auteur: { _id: currentUser._id, nom: currentUser.nom, photoProfil: currentUser.photoProfil },
                texte: texte.trim(),
                replyTo: commentData.replyTo || null
            }
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

// Réagir à un commentaire
router.post("/post/:postId/comment/:commentId/react", requireAuth, async (req, res) => {
    try {
        const { type } = req.body
        const validTypes = ["heart","haha","wow","sad","clap","grr"]
        if (!validTypes.includes(type)) return res.status(400).json({ error: "Type invalide" })

        const post = await Post.findById(req.params.postId)
        if (!post) return res.status(404).json({ error: "Post introuvable" })

        const comment = post.commentaires.id(req.params.commentId)
        if (!comment) return res.status(404).json({ error: "Commentaire introuvable" })

        const userId = req.session.user.id
        if (!comment.likes) comment.likes = []
        if (!comment.reactions) comment.reactions = []

        const existingIdx = comment.reactions.findIndex(r => r.user && r.user.toString() === userId)
        const existingType = existingIdx !== -1 ? comment.reactions[existingIdx].type : null

        if (existingType === type) {
            comment.reactions.splice(existingIdx, 1)
            comment.likes = comment.likes.filter(id => id.toString() !== userId)
        } else {
            if (existingIdx !== -1) comment.reactions.splice(existingIdx, 1)
            comment.reactions.push({ user: userId, type })
            if (!comment.likes.some(id => id.toString() === userId)) comment.likes.push(userId)
        }

        await post.save()
        res.json({ success: true, likesCount: comment.likes.length, userReaction: existingType === type ? null : type })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

// Suggestions @mention
router.get("/users/suggest", requireAuth, async (req, res) => {
    try {
        const q = (req.query.q || '').trim()
        if (!q) return res.json([])
        const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const users = await User.find({ nom: new RegExp(escapedQ, 'i') }).select('_id nom photoProfil').limit(5)
        res.json(users)
    } catch (err) { res.json([]) }
})

// Partager un post (AJAX)
router.post("/post/:id/share", requireAuth, requireNotRestricted("posts"), async (req, res) => {
    try {
        const { message } = req.body
        const originalPost = await Post.findById(req.params.id)
            .populate("auteur", "nom photoProfil badges")

        if (!originalPost) {
            return res.status(404).json({ error: "Publication introuvable." })
        }

        const alreadyShared = await Post.findOne({
            auteur: req.session.user.id,
            sharedFrom: originalPost._id,
            isShared: true
        })

        if (alreadyShared) {
            return res.status(400).json({ error: "Tu as déjà partagé cette publication." })
        }

        const sharedPost = await Post.create({
            auteur: req.session.user.id,
            contenu: message?.trim() || "",
            isShared: true,
            sharedFrom: originalPost._id,
            shareMessage: message?.trim() || ""
        })

        await Post.findByIdAndUpdate(originalPost._id, { $inc: { sharesCount: 1 } })
        await User.findByIdAndUpdate(req.session.user.id, { $inc: { xp: 3 } })

        // =============================================
        // === ORACLE / ANALYTICS : tracker SHARE ===
        // =============================================
        await track(req.session.user.id, 'SHARE')

        const populated = await Post.findById(sharedPost._id)
            .populate("auteur", "nom photoProfil badges")
            .populate({
                path: "sharedFrom",
                populate: { path: "auteur", select: "nom photoProfil badges" }
            })

        res.json({
            success: true,
            post: populated,
            sharesCount: originalPost.sharesCount + 1
        })

        // Notification en arrière-plan — ne bloque pas la réponse
        if (originalPost.auteur._id.toString() !== req.session.user.id) {
            try {
                const notification = await Notification.create({
                    destinataire: originalPost.auteur._id,
                    expediteur: req.session.user.id,
                    type: "partage",
                    lien: "/"
                })
                if (global.io) {
                    const notifComplete = await Notification.findById(notification._id)
                        .populate("expediteur", "nom photoProfil")
                    global.io.to(originalPost.auteur._id.toString()).emit("notification", notifComplete)
                }
            } catch (e) { console.error("Notif partage:", e.message) }
        }
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

// Nombre de partages d'un post (AJAX)
router.get("/post/:id/shares", requireAuth, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id)
        if (!post) return res.status(404).json({ error: "Publication introuvable." })
        res.json({ success: true, sharesCount: post.sharesCount || 0 })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Erreur serveur" })
    }
})

// Route /feed
router.get("/feed", requireAuth, async (req, res) => {
    try {
        const currentUser = await User.findById(req.session.user.id)

        const rawPosts = await Post.find()
            .populate("auteur", "nom photoProfil badges profileEffect")
            .populate("commentaires.auteur", "nom photoProfil badges profileEffect")
            .populate({
                path: "sharedFrom",
                populate: { path: "auteur", select: "nom photoProfil badges" }
            })
            .sort({ createdAt: -1 })
            .limit(50)

        const posts = rawPosts.filter(p => p.auteur != null)
        const demandesCount = currentUser.demandesRecues.length

        res.render("feed", {
            title: "Accueil",
            currentPage: "feed",
            posts,
            currentUserId: currentUser._id.toString(),
            demandesCount
        })
    } catch (err) {
        console.error(err)
        req.flash("error", "Erreur lors du chargement du feed.")
        res.redirect("/login")
    }
})

router.get("/api/download-image", requireAuth, async (req, res) => {
    const { url } = req.query
    if (!url) return res.status(400).send("URL manquante")
    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
        if (!response.ok) return res.status(502).send("Impossible de récupérer l'image")
        const contentType = response.headers.get("content-type") || "image/jpeg"
        const ext = contentType.includes("png") ? "png" : contentType.includes("gif") ? "gif" : contentType.includes("webp") ? "webp" : "jpg"
        const buffer = Buffer.from(await response.arrayBuffer())
        res.setHeader("Content-Disposition", `attachment; filename="socialapp-${Date.now()}.${ext}"`)
        res.setHeader("Content-Type", contentType)
        res.send(buffer)
    } catch (e) {
        res.status(500).send("Erreur lors du téléchargement")
    }
})

module.exports = router
