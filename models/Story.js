const mongoose = require("mongoose")

const storySchema = new mongoose.Schema({
    auteur: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    media: {
        type: String,
        required: true
    },
    mediaType: {
        type: String,
        enum: ["image", "video"],
        default: "image"
    },
    texte: {
        type: String,
        default: "",
        maxlength: 200
    },
    couleurFond: {
        type: String,
        default: null
    },
    vues: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        viewedAt: { type: Date, default: Date.now }
    }],
    reactions: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        emoji: { type: String }
    }],
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
}, { timestamps: true })

// ============================================================
// INDEXES — auteur, TTL, feed
// ============================================================
storySchema.index({ auteur: 1, expiresAt: 1 })    // stories d'un utilisateur
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }) // suppression TTL

module.exports = mongoose.models.Story || mongoose.model("Story", storySchema)
