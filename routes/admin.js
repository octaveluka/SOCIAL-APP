const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Post = require("../models/Post");
const Group = require("../models/Group");
const Message = require("../models/Message");
const Notification = require("../models/Notification");
const { requireAdmin } = require("../middleware/auth");
const assistant = require("../lib/assistant");
const { getTodayStats, getWeekStats, getRankings } = require("../lib/analytics");
const DailyQuest = require("../models/DailyQuest");
const SecurityEvent = require("../models/SecurityEvent");

// Dashboard principal
router.get("/admin", requireAdmin, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalPosts = await Post.countDocuments();
        const totalGroups = await Group.countDocuments();
        const totalMessages = await Message.countDocuments();
        const onlineUsers = await User.countDocuments({ enLigne: true });
        const disabledUsers = await User.countDocuments({ isDisabled: true });
        const totalCoins = await User.aggregate([{ $group: { _id: null, total: { $sum: "$walletBalance" } } }]);

        res.render("admin-dashboard", {
            title: "Dashboard Admin",
            currentPage: "admin",
            stats: {
                totalUsers,
                totalPosts,
                totalGroups,
                totalMessages,
                onlineUsers,
                disabledUsers,
                totalCoins: totalCoins[0]?.total || 0
            }
        });
    } catch (err) {
        console.error(err);
        res.redirect("/");
    }
});

// ============================================================
// === ORACLE / ANALYTICS DASHBOARD ===
// ============================================================
router.get("/admin/analytics", requireAdmin, async (req, res) => {
    try {
        const todayStr = new Date().toISOString().slice(0, 10);

        const [today, week, rankings, questsToday, questsCompleted, questsClaimed, topQuestTypes] = await Promise.all([
            getTodayStats(),
            getWeekStats(),
            getRankings(),
            DailyQuest.countDocuments({ day: todayStr }),
            DailyQuest.countDocuments({ day: todayStr, completed: true }),
            DailyQuest.countDocuments({ day: todayStr, claimed: true }),
            DailyQuest.aggregate([
                { $match: { day: todayStr } },
                { $group: { _id: "$quest.type", count: { $sum: 1 }, completed: { $sum: { $cond: ["$completed", 1, 0] } } } },
                { $sort: { count: -1 } },
                { $limit: 5 }
            ])
        ]);

        const topClaimers = await DailyQuest.find({ day: todayStr, claimed: true })
            .populate("userId", "nom photoProfil")
            .sort({ updatedAt: -1 })
            .limit(5)
            .lean();

        const oracleStats = {
            total: questsToday,
            completed: questsCompleted,
            claimed: questsClaimed,
            completionRate: questsToday > 0 ? Math.round((questsCompleted / questsToday) * 100) : 0,
            claimRate: questsToday > 0 ? Math.round((questsClaimed / questsToday) * 100) : 0,
            topTypes: topQuestTypes,
            topClaimers
        };

        res.render("admin-analytics", {
            title: "Oracle — Analytics",
            currentPage: "admin",
            today,
            week,
            rankings,
            oracleStats
        });
    } catch (err) {
        console.error("Erreur analytics:", err);
        req.flash("error", "Erreur lors du chargement des statistiques.");
        res.redirect("/admin");
    }
});

// Relancer la campagne de bienvenue
router.post("/admin/welcome-campaign", requireAdmin, async (req, res) => {
    try {
        await assistant.sendWelcomeToAll();
        req.flash("success", "✅ Campagne de bienvenue relancée.");
    } catch (err) {
        console.error(err);
        req.flash("error", "❌ Erreur lors de l'envoi de la campagne.");
    }
    res.redirect("/admin");
});

// Liste des utilisateurs
router.get("/admin/users", requireAdmin, async (req, res) => {
    try {
        const { q } = req.query;
        let filter = {};

        if (q && q.trim().length > 0) {
            const escapedQ = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            filter = {
                $or: [
                    { nom: { $regex: escapedQ, $options: "i" } },
                    { email: { $regex: escapedQ, $options: "i" } }
                ]
            };
        }

        const users = await User.find(filter).sort({ createdAt: -1 });

        res.render("admin-users", {
            title: "Gestion des utilisateurs",
            currentPage: "admin",
            users,
            query: q || "",
            currentUserId: req.session.user.id
        });
    } catch (err) {
        console.error(err);
        res.redirect("/admin");
    }
});

// ============================================================
// DÉSACTIVATION AVEC MOTIF (AJAX)
// ============================================================
router.post("/admin/users/:id/disable", requireAdmin, async (req, res) => {
    try {
        const { reason, contact } = req.body;
        const targetUser = await User.findById(req.params.id);
        if (!targetUser) return res.status(404).json({ error: "Utilisateur introuvable" });

        if (targetUser._id.toString() === req.session.user.id) {
            return res.status(400).json({ error: "Tu ne peux pas désactiver ton propre compte." });
        }

        targetUser.isDisabled = true;
        targetUser.disableReason = reason || "Non spécifié";
        targetUser.disableContact = contact || null;
        await targetUser.save();

        res.json({ success: true, isDisabled: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// Réactiver un compte (AJAX)
router.post("/admin/users/:id/enable", requireAdmin, async (req, res) => {
    try {
        const targetUser = await User.findById(req.params.id);
        if (!targetUser) return res.status(404).json({ error: "Utilisateur introuvable" });

        targetUser.isDisabled = false;
        targetUser.disableReason = null;
        targetUser.disableContact = null;
        await targetUser.save();

        res.json({ success: true, isDisabled: false });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// ============================================================
// SUPPRESSION AVEC MOTIF (AJAX)
// ============================================================
router.post("/admin/users/:id/delete", requireAdmin, async (req, res) => {
    try {
        const { reason } = req.body;
        const targetUser = await User.findById(req.params.id);
        if (!targetUser) return res.status(404).json({ error: "Utilisateur introuvable" });

        if (targetUser._id.toString() === req.session.user.id) {
            return res.status(400).json({ error: "Tu ne peux pas supprimer ton propre compte." });
        }

        targetUser.deletionReason = reason || "Non spécifié";
        targetUser.isDisabled = true;

        await Post.deleteMany({ auteur: targetUser._id });
        await Message.deleteMany({ $or: [{ expediteur: targetUser._id }, { destinataire: targetUser._id }] });
        await User.updateMany({}, {
            $pull: {
                amis: targetUser._id,
                demandesRecues: targetUser._id,
                demandesEnvoyees: targetUser._id
            }
        });

        targetUser.nom = "Compte supprimé";
        targetUser.email = `deleted_${targetUser._id}@supprimé.com`;
        targetUser.bio = "";
        targetUser.photoProfil = "https://ui-avatars.com/api/?background=dc2626&color=fff&name=X";
        targetUser.amis = [];
        targetUser.demandesRecues = [];
        targetUser.demandesEnvoyees = [];
        targetUser.badges = [];
        targetUser.walletBalance = 0;
        targetUser.xp = 0;
        await targetUser.save();

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// ============================================================
// RESTRICTIONS TEMPORAIRES (AJAX)
// ============================================================
router.post("/admin/users/:id/restrict", requireAdmin, async (req, res) => {
    try {
        const { type, duree } = req.body;
        const types = ["messages", "invitations", "likes", "posts"];

        if (!types.includes(type)) {
            return res.status(400).json({ error: "Type de restriction invalide." });
        }

        const targetUser = await User.findById(req.params.id);
        if (!targetUser) return res.status(404).json({ error: "Utilisateur introuvable" });

        if (targetUser._id.toString() === req.session.user.id) {
            return res.status(400).json({ error: "Tu ne peux pas te restreindre toi-même." });
        }

        const minutes = parseInt(duree) || 60;
        const until = new Date(Date.now() + minutes * 60 * 1000);

        if (!targetUser.restrictions) targetUser.restrictions = {};
        targetUser.restrictions[type] = { until };
        targetUser.markModified("restrictions");
        await targetUser.save();

        await Notification.create({
            destinataire: targetUser._id,
            expediteur: req.session.user.id,
            type: "system",
            lien: "/",
            message: `Ton accès à "${type}" a été restreint pour ${minutes} minutes.`
        });

        if (global.io) {
            global.io.to(targetUser._id.toString()).emit("account-restricted", {
                type,
                until,
                message: `Tu es restreint(e) sur "${type}" pendant ${minutes} minutes.`
            });
        }

        res.json({ success: true, until });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// Lever une restriction (AJAX)
router.post("/admin/users/:id/unrestrict/:type", requireAdmin, async (req, res) => {
    try {
        const targetUser = await User.findById(req.params.id);
        if (!targetUser) return res.status(404).json({ error: "Utilisateur introuvable" });

        if (targetUser.restrictions && targetUser.restrictions[req.params.type]) {
            targetUser.restrictions[req.params.type] = { until: null };
            targetUser.markModified("restrictions");
            await targetUser.save();
        }

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// ============================================================
// ENVOI DE COINS (AJAX)
// ============================================================
router.post("/admin/users/:id/send-coins", requireAdmin, async (req, res) => {
    try {
        const { amount, reason } = req.body;
        const coins = parseInt(amount);

        if (!coins || coins <= 0 || coins > 100000) {
            return res.status(400).json({ error: "Montant invalide (1 à 100 000 coins)." });
        }

        const targetUser = await User.findById(req.params.id);
        if (!targetUser) return res.status(404).json({ error: "Utilisateur introuvable" });

        targetUser.walletBalance = (targetUser.walletBalance || 0) + coins;
        await targetUser.save();

        const { sendPushToUser, buildPayload } = require("../lib/webpush");
        await sendPushToUser(targetUser._id, buildPayload("coins", {
            amount: coins,
            reason: reason || ""
        }));

        await Notification.create({
            destinataire: targetUser._id,
            expediteur: req.session.user.id,
            type: "system",
            lien: "/wallet",
            message: `Tu as reçu ${coins} coins ! ${reason ? "Motif : " + reason : ""}`
        });

        if (global.io) {
            global.io.to(targetUser._id.toString()).emit("coins-received", {
                amount: coins,
                newBalance: targetUser.walletBalance,
                reason: reason || ""
            });
        }

        res.json({ success: true, newBalance: targetUser.walletBalance });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// ============================================================
// AVERTISSEMENT (AJAX)
// ============================================================
router.post("/admin/users/:id/warn", requireAdmin, async (req, res) => {
    try {
        const { motif } = req.body;
        if (!motif || motif.trim().length === 0) {
            return res.status(400).json({ error: "Le motif est requis." });
        }

        const targetUser = await User.findById(req.params.id);
        if (!targetUser) return res.status(404).json({ error: "Utilisateur introuvable" });

        if (!targetUser.warnings) targetUser.warnings = [];
        targetUser.warnings.push({ motif: motif.trim() });
        await targetUser.save();

        const { sendPushToUser, buildPayload } = require("../lib/webpush");
        await sendPushToUser(targetUser._id, buildPayload("warning", {
            motif: motif.trim()
        }));

        await Notification.create({
            destinataire: targetUser._id,
            expediteur: req.session.user.id,
            type: "system",
            lien: "/",
            message: `⚠️ Avertissement reçu : ${motif.trim()}`
        });

        if (global.io) {
            global.io.to(targetUser._id.toString()).emit("warning-received", {
                motif: motif.trim(),
                total: targetUser.warnings.length
            });
        }

        res.json({ success: true, total: targetUser.warnings.length });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// ============================================================
// BADGES (AJAX)
// ============================================================
router.post("/admin/users/:id/badges/add", requireAdmin, async (req, res) => {
    try {
        const { type } = req.body;
        const types = ["verifie", "moderateur", "fondateur", "premium", "staff"];

        if (!type || !types.includes(type)) {
            return res.status(400).json({ error: "Type de badge invalide." });
        }

        const targetUser = await User.findById(req.params.id);
        if (!targetUser) return res.status(404).json({ error: "Utilisateur introuvable" });

        const alreadyHas = targetUser.badges.some(b => b.type === type);
        if (alreadyHas) {
            return res.status(400).json({ error: "Cet utilisateur a déjà ce badge." });
        }

        targetUser.badges.push({ type });
        await targetUser.save();

        res.json({ success: true, type });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

router.post("/admin/users/:id/badges/remove/:type", requireAdmin, async (req, res) => {
    try {
        const targetUser = await User.findById(req.params.id);
        if (!targetUser) return res.status(404).json({ error: "Utilisateur introuvable" });

        targetUser.badges = targetUser.badges.filter(b => b.type !== req.params.type);
        await targetUser.save();

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// Changer le rôle (AJAX)
router.post("/admin/users/:id/toggle-role", requireAdmin, async (req, res) => {
    try {
        const targetUser = await User.findById(req.params.id);
        if (!targetUser) return res.status(404).json({ error: "Utilisateur introuvable" });

        if (targetUser._id.toString() === req.session.user.id) {
            return res.status(400).json({ error: "Tu ne peux pas modifier ton propre rôle." });
        }

        targetUser.role = targetUser.role === "admin" ? "user" : "admin";
        await targetUser.save();

        res.json({ success: true, role: targetUser.role });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// ============================================================
// === PANNEAU SÉCURITÉ / IDS ===
// ============================================================
router.get("/admin/security", requireAdmin, async (req, res) => {
    try {
        const events = await SecurityEvent.find()
            .sort({ timestamp: -1 })
            .limit(200)
            .lean()

        const stats = {
            total: await SecurityEvent.countDocuments(),
            failedLogins: await SecurityEvent.countDocuments({ type: "failed_login" }),
            bruteForce: await SecurityEvent.countDocuments({ type: "brute_force" }),
            suspicious: await SecurityEvent.countDocuments({ type: { $nin: ["failed_login", "brute_force"] } }),
            lastHour: await SecurityEvent.countDocuments({ timestamp: { $gte: new Date(Date.now() - 3600000) } })
        }

        res.render("admin-security", {
            title: "Sécurité — IDS",
            currentPage: "admin",
            events,
            stats
        })
    } catch (err) {
        console.error(err)
        res.redirect("/admin")
    }
})

// API : événements récents (pour polling temps réel)
router.get("/api/admin/security/events", requireAdmin, async (req, res) => {
    try {
        const since = req.query.since ? new Date(req.query.since) : new Date(Date.now() - 3600000)
        const events = await SecurityEvent.find({ timestamp: { $gte: since } })
            .sort({ timestamp: -1 })
            .limit(50)
            .lean()
        res.json({ events })
    } catch (err) {
        res.status(500).json({ error: "Erreur serveur" })
    }
})

module.exports = router;
