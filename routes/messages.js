const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const User = require("../models/User");
const Group = require("../models/Group");
const { requireAuth } = require("../middleware/auth");
const { uploadAudio, uploadPost } = require("../lib/cloudinary");
const { track } = require("../lib/analytics"); // ← AJOUT
const { validateObjectId } = require("../lib/intrusionDetection");

// Nombre de messages non lus (pour badges SPA)
router.get("/api/messages/unread-count", requireAuth, async (req, res) => {
    try {
        const count = await Message.countDocuments({ destinataire: req.session.user.id, lu: false })
        res.json({ count })
    } catch (e) {
        res.json({ count: 0 })
    }
})

// Liste des conversations
router.get("/messages", requireAuth, async (req, res) => {
    try {
        const currentUserId = req.session.user.id;
        const messages = await Message.find({
            $or: [{ expediteur: currentUserId }, { destinataire: currentUserId }],
            groupe: null
        }).sort({ createdAt: -1 });

        const partnerIds = [];
        messages.forEach(m => {
            if (!m.destinataire) return;
            const other = m.expediteur.toString() === currentUserId
                ? m.destinataire.toString()
                : m.expediteur.toString();
            if (!partnerIds.includes(other)) partnerIds.push(other);
        });

        const conversations = [];
        for (const id of partnerIds) {
            const partner = await User.findById(id);
            if (!partner) continue;
            const lastMsg = messages.find(m =>
                m.destinataire && (m.expediteur.toString() === id || m.destinataire.toString() === id)
            );
            const unreadCount = await Message.countDocuments({ expediteur: id, destinataire: currentUserId, lu: false });
            const currentUser2 = await User.findById(currentUserId);
            const locked = currentUser2.vaultedChats?.has(id) || false;
            conversations.push({ partner, lastMsg, unreadCount, locked });
        }

        const currentUser = await User.findById(currentUserId).populate("amis", "nom photoProfil enLigne");
        const groupes = await Group.find({ "membres.user": currentUserId });

        res.render("messages", {
            title: "Messages",
            currentPage: "messages",
            conversations,
            amis: currentUser.amis,
            groupes,
            currentUserId
        });
    } catch (err) {
        console.error(err);
        res.redirect("/");
    }
});

// Conversation avec un utilisateur
router.get("/messages/:id", requireAuth, async (req, res) => {
    try {
        const currentUserId = req.session.user.id;
        const otherId = req.params.id;
        const otherUser = await User.findById(otherId);
        if (!otherUser) {
            req.flash("error", "Utilisateur introuvable.");
            return res.redirect("/messages");
        }

        const messages = await Message.find({
            groupe: null,
            $or: [
                { expediteur: currentUserId, destinataire: otherId },
                { expediteur: otherId, destinataire: currentUserId }
            ]
        }).populate("repondA").sort({ createdAt: 1 });

        await Message.updateMany(
            { expediteur: otherId, destinataire: currentUserId, lu: false },
            { lu: true }
        );

        const currentUser = await User.findById(currentUserId);
        const isLocked = currentUser.vaultedChats?.has(otherId) || false;
        const isBlocked = (currentUser.blockedUsers || []).map(b => b.toString()).includes(otherId);
        const chatNickname = currentUser.chatNicknames?.get(otherId) || null;

        res.render("chat", {
            title: chatNickname || otherUser.nom,
            currentPage: "messages",
            otherUser,
            messages,
            currentUserId,
            isLocked,
            isIncognito: currentUser.isIncognitoInput || false,
            isBlocked,
            chatNickname
        });
    } catch (err) {
        console.error(err);
        res.redirect("/messages");
    }
});

// Supprimer un message (soft delete)
router.post("/api/messages/:id/delete", requireAuth, validateObjectId(), async (req, res) => {
    try {
        const msg = await Message.findById(req.params.id);
        if (!msg) return res.status(404).json({ error: "Message introuvable." });
        if (msg.expediteur.toString() !== req.session.user.id) {
            return res.status(403).json({ error: "Tu ne peux supprimer que tes propres messages." });
        }
        msg.isDeleted = true;
        msg.contenu = "";
        // FIX-07: effacer aussi les champs média pour supprimer vraiment le contenu
        msg.audio = null;
        msg.image = null;
        await msg.save();

        if (global.io) {
            const room = msg.destinataire ? msg.destinataire.toString() : "group_" + msg.groupe;
            const senderId = msg.expediteur.toString();
            const event = msg.groupe ? "group-message-deleted" : "message-deleted";
            global.io.to(room).emit(event, { messageId: msg._id });
            global.io.to(senderId).emit(event, { messageId: msg._id });
        }
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur serveur." });
    }
});

// Réactions en Ib (messages privés)
router.post("/api/messages/:id/react", requireAuth, validateObjectId(), async (req, res) => {
    try {
        const { emoji } = req.body;
        const userId = req.session.user.id;
        const msg = await Message.findById(req.params.id);
        if (!msg) return res.status(404).json({ error: "Message introuvable." });

        // FIX-10: vérifier que l'utilisateur est bien participant à cette conversation (IDOR)
        const isParticipant = msg.expediteur.toString() === userId ||
            (msg.destinataire && msg.destinataire.toString() === userId)
        if (!isParticipant) {
            return res.status(403).json({ error: "Accès non autorisé." });
        }

        // Retirer réaction existante de cet user
        msg.reactions = msg.reactions.filter(r => r.user.toString() !== userId);
        if (emoji) msg.reactions.push({ user: userId, emoji });
        await msg.save();

        if (global.io) {
            const otherId = msg.expediteur.toString() === userId
                ? msg.destinataire?.toString()
                : msg.expediteur.toString();
            if (otherId) {
                global.io.to(otherId).emit("message-reacted-ib", { messageId: msg._id, reactions: msg.reactions });
                global.io.to(userId).emit("message-reacted-ib", { messageId: msg._id, reactions: msg.reactions });
            }
        }
        res.json({ success: true, reactions: msg.reactions });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur serveur." });
    }
});

// Envoyer un message vocal
router.post("/messages/audio", requireAuth, uploadAudio.single("audio"), async (req, res) => {
    try {
        const { to, groupId, duration } = req.body;
        const currentUserId = req.session.user.id;
        if (!req.file) return res.status(400).json({ error: "Aucun fichier audio envoyé." });
        if (!to && !groupId) return res.status(400).json({ error: "Destinataire ou groupe requis." });

        // FIX-08: vérifier l'appartenance au groupe avant d'envoyer un audio
        if (groupId) {
            const Group = require("../models/Group");
            const group = await Group.findById(groupId);
            if (!group) return res.status(404).json({ error: "Groupe introuvable." });
            const isMember = group.membres.some(m => m.user.toString() === currentUserId);
            const isSiteAdmin = req.session.user.role === "admin";
            if (!isMember && !isSiteAdmin) {
                return res.status(403).json({ error: "Tu n'es pas membre de ce groupe." });
            }
        }

        const newMessage = new Message({
            expediteur: currentUserId,
            destinataire: to || null,
            groupe: groupId || null,
            audio: req.file.path,
            duration: duration || null,
            lu: false
        });
        await newMessage.save();

        // XP pour message envoyé
        await User.findByIdAndUpdate(currentUserId, { $inc: { xp: 1 } });

        // =============================================
        // === ORACLE / ANALYTICS : tracker MESSAGE ===
        // =============================================
        await track(currentUserId, 'MESSAGE');

        const expediteur = await User.findById(currentUserId);
        const payload = {
            _id: newMessage._id,
            expediteur: currentUserId,
            destinataire: to,
            groupe: groupId,
            audio: req.file.path,
            duration: duration || null,
            contenu: "",
            lu: false,
            createdAt: newMessage.createdAt,
            expediteurNom: expediteur.nom,
            expediteurPhoto: expediteur.photoProfil
        };

        if (global.io) {
            if (to) {
                global.io.to(to).emit("new-message", payload);
                global.io.to(currentUserId).emit("new-message", payload);
            } else if (groupId) {
                global.io.to("group_" + groupId).emit("new-group-message", payload);
            }
        }
        res.json({ success: true, message: payload });
    } catch (err) {
        console.error("Erreur upload audio:", err);
        res.status(500).json({ error: err.message || "Erreur lors de l'envoi du message vocal." });
    }
});

// Bloquer / Débloquer un utilisateur
router.post("/api/chat/:id/block", requireAuth, async (req, res) => {
    try {
        const currentUserId = req.session.user.id;
        const targetId = req.params.id;
        const currentUser = await User.findById(currentUserId);
        const isBlocked = currentUser.blockedUsers.map(b => b.toString()).includes(targetId);
        if (isBlocked) {
            await User.findByIdAndUpdate(currentUserId, { $pull: { blockedUsers: targetId } });
            res.json({ success: true, blocked: false });
        } else {
            await User.findByIdAndUpdate(currentUserId, { $addToSet: { blockedUsers: targetId } });
            res.json({ success: true, blocked: true });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur serveur." });
    }
});

// Définir un pseudo de conversation
router.post("/api/chat/:id/nickname", requireAuth, async (req, res) => {
    try {
        const currentUserId = req.session.user.id;
        const targetId = req.params.id;
        const { nickname } = req.body;
        const currentUser = await User.findById(currentUserId);
        if (!currentUser.chatNicknames) currentUser.chatNicknames = new Map();
        if (nickname && nickname.trim()) {
            currentUser.chatNicknames.set(targetId, nickname.trim().slice(0, 30));
        } else {
            currentUser.chatNicknames.delete(targetId);
        }
        currentUser.markModified("chatNicknames");
        await currentUser.save();
        res.json({ success: true, nickname: nickname ? nickname.trim() : null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur serveur." });
    }
});

// Supprimer la conversation (côté courant uniquement)
router.post("/api/chat/:id/clear", requireAuth, async (req, res) => {
    try {
        const currentUserId = req.session.user.id;
        const targetId = req.params.id;
        await Message.deleteMany({
            groupe: null,
            $or: [
                { expediteur: currentUserId, destinataire: targetId },
                { expediteur: targetId, destinataire: currentUserId }
            ]
        });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur serveur." });
    }
});

// Envoyer une photo
router.post("/messages/photo", requireAuth, uploadPost.single("image"), async (req, res) => {
    try {
        const { to, groupId } = req.body;
        const currentUserId = req.session.user.id;
        if (!req.file) return res.status(400).json({ error: "Aucune image envoyée." });
        if (!to && !groupId) return res.status(400).json({ error: "Destinataire ou groupe requis." });

        // FIX-09: vérifier l'appartenance au groupe avant d'envoyer une photo
        if (groupId) {
            const Group = require("../models/Group");
            const group = await Group.findById(groupId);
            if (!group) return res.status(404).json({ error: "Groupe introuvable." });
            const isMember = group.membres.some(m => m.user.toString() === currentUserId);
            const isSiteAdmin = req.session.user.role === "admin";
            if (!isMember && !isSiteAdmin) {
                return res.status(403).json({ error: "Tu n'es pas membre de ce groupe." });
            }
        }

        const newMessage = new Message({
            expediteur: currentUserId,
            destinataire: to || null,
            groupe: groupId || null,
            image: req.file.path,
            lu: false
        });
        await newMessage.save();

        // =============================================
        // === ORACLE / ANALYTICS : tracker MESSAGE ===
        // =============================================
        await track(currentUserId, 'MESSAGE');

        const expediteur = await User.findById(currentUserId);
        const payload = {
            _id: newMessage._id,
            expediteur: currentUserId,
            destinataire: to,
            groupe: groupId,
            image: req.file.path,
            contenu: "",
            lu: false,
            createdAt: newMessage.createdAt,
            expediteurNom: expediteur.nom,
            expediteurPhoto: expediteur.photoProfil
        };

        if (global.io) {
            if (to) {
                global.io.to(to).emit("new-message", payload);
                global.io.to(currentUserId).emit("new-message", payload);
            } else if (groupId) {
                global.io.to("group_" + groupId).emit("new-group-message", payload);
            }
        }
        res.json({ success: true, message: payload });
    } catch (err) {
        console.error("Erreur upload photo:", err);
        res.status(500).json({ error: err.message || "Erreur lors de l'envoi de l'image." });
    }
});

module.exports = router;
