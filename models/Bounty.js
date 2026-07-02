const mongoose = require("mongoose")

const bountySchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, default: "", maxlength: 500 },
    actionType: { type: String, default: null },
    rewardAmount: { type: Number, required: true, min: 1 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["open", "claimed", "closed"], default: "open" },
    claimedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    applicants: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        message: { type: String, maxlength: 500 },
        verified: { type: Boolean, default: false },
        submittedAt: { type: Date, default: Date.now }
    }],
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", default: null }
}, { timestamps: true })

// ============================================================
// INDEXES — statut, créateur
// ============================================================
bountySchema.index({ status: 1, createdAt: -1 }) // primes ouvertes
bountySchema.index({ createdBy: 1 })              // primes d'un user

module.exports = mongoose.models.Bounty || mongoose.model("Bounty", bountySchema)
