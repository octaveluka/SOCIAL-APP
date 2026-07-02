const mongoose = require("mongoose")

const ipBanSchema = new mongoose.Schema({
    ip: { type: String, required: true, unique: true, index: true },
    reason: { type: String, default: "Brute-force automatique" },
    bannedBy: { type: String, default: "système" },
    permanent: { type: Boolean, default: false },
    bannedUntil: { type: Date, default: null },
    bannedAt: { type: Date, default: Date.now },
    triggerCount: { type: Number, default: 0 }
})

ipBanSchema.index({ bannedUntil: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { permanent: false } })

module.exports = mongoose.model("IPBan", ipBanSchema)
