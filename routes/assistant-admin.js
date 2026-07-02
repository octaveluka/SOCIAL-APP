const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Post = require("../models/Post");
const { requireAdmin } = require("../middleware/auth");
const assistant = require("../lib/assistant");
const { uploadPost } = require("../lib/cloudinary");

// Dashboard de gestion de l'assistant
router.get("/admin/assistant", requireAdmin, async (req, res) => {
    try {
        const bot = await User.findOne({ isBot: true });
        if (!bot) {
            req.flash("error", "Assistant introuvable. Redémarre le serveur.");
            return res.redirect("/admin");
        }

        res.render("admin-assistant", {
            title: "Gestion de l'assistant",
            currentPage: "admin",
            bot
        });
    } catch (err) {
        console.error("Erreur /admin/assistant :", err);
        req.flash("error", "Erreur : " + err.message);
        res.redirect("/admin");
    }
});

// Changer la photo de l'assistant (Cloudinary)
router.post("/admin/assistant/photo", requireAdmin, uploadPost.single("photo"), async (req, res) => {
    try {
        const bot = await User.findOne({ isBot: true });
        if (!bot) return res.status(404).json({ error: "Assistant introuvable" });

        if (req.file) {
            bot.photoProfil = req.file.path;
            await bot.save();
        }

        req.flash("success", "Photo de l'assistant mise à jour !");
        res.redirect("/admin/assistant");
    } catch (err) {
        console.error(err);
        req.flash("error", "Erreur lors de la mise à jour");
        res.redirect("/admin/assistant");
    }
});

// Changer la bio de l'assistant
router.post("/admin/assistant/bio", requireAdmin, async (req, res) => {
    try {
        const { bio } = req.body;
        const bot = await User.findOne({ isBot: true });
        if (!bot) return res.status(404).json({ error: "Assistant introuvable" });

        // FIX-17: limiter la longueur de la bio pour prévenir les abus
        const cleanBio = (bio || "").trim().slice(0, 500)
        bot.bio = cleanBio || "Assistant officiel de SocialApp – Je réponds à toutes tes questions !";
        await bot.save();

        req.flash("success", "Bio de l'assistant mise à jour !");
        res.redirect("/admin/assistant");
    } catch (err) {
        console.error(err);
        req.flash("error", "Erreur lors de la mise à jour");
        res.redirect("/admin/assistant");
    }
});

// Envoyer un message de mise à jour à tous les utilisateurs
router.post("/admin/assistant/update", requireAdmin, async (req, res) => {
    try {
        const { message } = req.body;
        if (!message || message.trim().length === 0) {
            req.flash("error", "Le message ne peut pas être vide.");
            return res.redirect("/admin/assistant");
        }
        // FIX-17: limiter la longueur du message de mise à jour
        if (message.trim().length > 1000) {
            req.flash("error", "Le message ne peut pas dépasser 1000 caractères.");
            return res.redirect("/admin/assistant");
        }

        await assistant.sendUpdateMessage(message.trim());
        req.flash("success", "Message de mise à jour envoyé à tous les utilisateurs !");
        res.redirect("/admin/assistant");
    } catch (err) {
        console.error(err);
        req.flash("error", "Erreur lors de l'envoi");
        res.redirect("/admin/assistant");
    }
});

// Publier un post au nom de l'assistant (avec image Cloudinary)
router.post("/admin/assistant/post", requireAdmin, uploadPost.single("image"), async (req, res) => {
    try {
        const { contenu } = req.body;
        if (!contenu || contenu.trim().length === 0) {
            req.flash("error", "Le contenu ne peut pas être vide.");
            return res.redirect("/admin/assistant");
        }

        const bot = await User.findOne({ isBot: true });
        if (!bot) {
            req.flash("error", "Assistant introuvable");
            return res.redirect("/admin/assistant");
        }

        const post = new Post({
            auteur: bot._id,
            contenu: contenu.trim(),
            image: req.file ? req.file.path : null
        });

        await post.save();
        req.flash("success", "Publication envoyée au nom de l'assistant !");
        res.redirect("/admin/assistant");
    } catch (err) {
        console.error(err);
        req.flash("error", "Erreur lors de la publication");
        res.redirect("/admin/assistant");
    }
});

// Relancer la campagne de bienvenue
router.post("/admin/assistant/welcome", requireAdmin, async (req, res) => {
    try {
        await assistant.sendWelcomeToAll();
        req.flash("success", "Campagne de bienvenue relancée !");
    } catch (err) {
        console.error(err);
        req.flash("error", "Erreur lors de la relance");
    }
    res.redirect("/admin/assistant");
});

module.exports = router;
