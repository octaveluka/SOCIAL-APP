const mongoose = require("mongoose")

const securityEventSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: [
            "failed_login",
            "brute_force",
            "suspicious_access",
            "invalid_objectid",
            "idor_attempt",
            "rate_limit_exceeded",
            "socket_flood",
            "invalid_password_reset",
            "unauthorized_media_access"
        ]
    },
    ip: { type: String, default: "unknown" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    email: { type: String, default: null },
    details: { type: String, default: null },
    userAgent: { type: String, default: null },
    timestamp: { type: Date, default: Date.now }
})

securityEventSchema.index({ timestamp: -1 })
securityEventSchema.index({ type: 1, ip: 1 })

module.exports = mongoose.model("SecurityEvent", securityEventSchema)
