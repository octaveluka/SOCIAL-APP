const mongoose = require("mongoose")

const messageSchema = new mongoose.Schema({
    expediteur: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    destinataire: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    groupe: { type: mongoose.Schema.Types.ObjectId, ref: "Group", default: null },
    contenu: { type: String, default: "", maxlength: 4000 },
    repondA: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },
    reactions: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        emoji: { type: String }
    }],
    lu: { type: Boolean, default: false },
    audio: { type: String, default: null },
    duration: { type: Number, default: null },
    image: { type: String, default: null },
    isSticker: { type: Boolean, default: false },

    // === NOUVELLES FONCTIONNALITÉS ===
    isDeleted: { type: Boolean, default: false },
    expiresAt: { type: Date, default: null },
    isCodeBlock: { type: Boolean, default: false },
    codeSignature: { type: String, default: null },
    codeAuthor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // SubProfile anonyme (pour les groupes)
    subProfileId: { type: mongoose.Schema.Types.ObjectId, ref: "SubProfile", default: null },
    anonymousName: { type: String, default: null },
    anonymousAvatar: { type: String, default: null },
}, { timestamps: true })

// ============================================================
// INDEXES — conversation, non-lus, groupes, éphémères
// ============================================================
messageSchema.index({ expediteur: 1, destinataire: 1, createdAt: -1 }) // conversation privée
messageSchema.index({ destinataire: 1, lu: 1 })                         // ⚡ comptage non-lus (middleware global)
messageSchema.index({ groupe: 1, createdAt: -1 })                       // messages de groupe
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })        // suppression TTL messages éphémères
messageSchema.index({ expediteur: 1, createdAt: -1 })                   // messages envoyés

module.exports = mongoose.models.Message || mongoose.model("Message", messageSchema)
