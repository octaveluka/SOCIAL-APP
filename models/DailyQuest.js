const mongoose = require("mongoose")

const dailyQuestSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    day: { type: String, required: true },
    quest: {
        text: { type: String, required: true },
        type: { type: String, required: true },
        targetCount: { type: Number, default: 1 },
        reward: {
            xp: { type: Number, default: 20 },
            coins: { type: Number, default: 50 }
        }
    },
    completed: { type: Boolean, default: false },
    claimed: { type: Boolean, default: false },
    progress: { type: Number, default: 0 },
    streak: { type: Number, default: 1 },
    bonusCoins: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true }
}, { timestamps: true })

dailyQuestSchema.index({ userId: 1, day: 1 }, { unique: true })

module.exports = mongoose.models.DailyQuest || mongoose.model("DailyQuest", dailyQuestSchema)
