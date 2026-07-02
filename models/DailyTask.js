const mongoose = require("mongoose")

const dailyTaskSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    taskType: { type: String, required: true },
    targetCount: { type: Number, default: 1 },
    reward: { type: Number, required: true },
    xpReward: { type: Number, default: 5 },
    day: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    completions: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        completedAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true })

// ============================================================
// INDEXES — jour, TTL
// ============================================================
dailyTaskSchema.index({ day: 1 })                                              // tâches du jour
dailyTaskSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })            // auto-purge après expiration
dailyTaskSchema.index({ "completions.userId": 1 })                             // vérification complétion

module.exports = mongoose.models.DailyTask || mongoose.model("DailyTask", dailyTaskSchema)
