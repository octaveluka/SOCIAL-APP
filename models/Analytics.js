const mongoose = require('mongoose')

const analyticsSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: [
            'LOGIN',
            'MESSAGE',
            'POST',
            'LIKE',
            'COMMENT',
            'STORY',
            'AI_USE',
            'GROUP_JOIN',
            'FRIEND_ADD'
        ],
        required: true
    },
    metadata: {
        type: Object,
        default: {}
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
})

// Index pour les requêtes rapides
analyticsSchema.index({ userId: 1, createdAt: -1 })
analyticsSchema.index({ type: 1, createdAt: -1 })
analyticsSchema.index({ createdAt: -1 })

module.exports = mongoose.model('Analytics', analyticsSchema)
