const mongoose = require("mongoose")

const EMOJI_ANIMALS = ["🐺","🦊","🐻","🐼","🦁","🐯","🦝","🦨","🦡","🦦","🐨","🐮","🐷","🐸","🐙","🦋","🐬","🦈","🐧","🦜"]

const subProfileSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    anonymousUsername: { type: String, required: true },
    anonymousAvatarUrl: { type: String, required: true },
    isActive: { type: Boolean, default: false }
}, { timestamps: true })

// ============================================================
// INDEXES
// ============================================================
subProfileSchema.index({ userId: 1 })  // sous-profils d'un utilisateur

subProfileSchema.statics.generateAnonymous = function() {
    const adjectives = ["Fantôme", "Ombre", "Ninja", "Spectre", "Mystère", "Inconnu", "Masqué", "Anonyme", "Secret", "Invisible"]
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
    const emoji = EMOJI_ANIMALS[Math.floor(Math.random() * EMOJI_ANIMALS.length)]
    const num = Math.floor(Math.random() * 9000) + 1000
    return {
        name: `${adj}${num}`,
        avatar: `https://ui-avatars.com/api/?background=374151&color=fff&name=${emoji}&bold=true`
    }
}

module.exports = mongoose.models.SubProfile || mongoose.model("SubProfile", subProfileSchema)
