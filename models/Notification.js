const mongoose = require("mongoose")

const notificationSchema = new mongoose.Schema({
    destinataire: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    expediteur: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    type: {
        type: String,
        enum: ["like", "commentaire", "demande_ami", "ami_accepte", "message", "abonnement", "reponse", "mention"],
        required: true
    },
    lien: {
        type: String,
        default: "/"
    },
    lu: {
        type: Boolean,
        default: false
    }
}, { timestamps: true })

// ============================================================
// INDEXES — non-lus, historique
// ============================================================
notificationSchema.index({ destinataire: 1, lu: 1 })            // ⚡ comptage non-lus (middleware global)
notificationSchema.index({ destinataire: 1, createdAt: -1 })    // liste des notifs
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 }) // auto-purge 30 jours

module.exports = mongoose.models.Notification || mongoose.model("Notification", notificationSchema)
