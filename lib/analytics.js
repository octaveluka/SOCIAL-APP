const Analytics = require('../models/Analytics')
const User = require('../models/User')
const Message = require('../models/Message')
const Post = require('../models/Post')
const Group = require('../models/Group')
const Story = require('../models/Story')
const Notification = require('../models/Notification')

// ============================================================
// TRACKER UN ÉVÉNEMENT (NON BLOQUANT)
// ============================================================
function track(userId, type, metadata = {}) {
    if (!userId) return

    // ⚠️ on ne bloque jamais le flux utilisateur
    setImmediate(async () => {
        try {
            await Analytics.create({
                userId,
                type,
                metadata
            })
        } catch (err) {
            console.error('❌ Erreur tracking:', err.message)
        }
    })
}

// ============================================================
// METTRE À JOUR lastSeen — throttle 30 sec/user (évite 1 write par requête)
// ============================================================
const _lastSeenThrottle = new Map()
const LAST_SEEN_TTL = 30 * 1000 // 30 secondes

function updateLastSeen(userId) {
    if (!userId) return
    const key = userId.toString()
    const now = Date.now()
    if (_lastSeenThrottle.has(key) && now - _lastSeenThrottle.get(key) < LAST_SEEN_TTL) return
    _lastSeenThrottle.set(key, now)

    setImmediate(async () => {
        try {
            await User.findByIdAndUpdate(userId, { lastSeen: new Date() }, { lean: true })
        } catch (err) {
            // silencieux
        }
    })
}

// ============================================================
// STATISTIQUES DU JOUR
// ============================================================
async function getTodayStats() {
    const start = new Date()
    start.setHours(0, 0, 0, 0)

    const end = new Date()
    end.setHours(23, 59, 59, 999)

    const match = { createdAt: { $gte: start, $lte: end } }

    const [
        activeUsers,
        messages,
        posts,
        comments,
        aiUsage,
        stories,
        newUsers,
        likes
    ] = await Promise.all([
        User.countDocuments({ lastSeen: { $gte: start } }),
        Message.countDocuments(match),
        Post.countDocuments(match),
        Analytics.countDocuments({ ...match, type: 'COMMENT' }),
        Analytics.countDocuments({ ...match, type: 'AI_USE' }),
        Story.countDocuments(match),
        User.countDocuments({ createdAt: { $gte: start } }),
        Analytics.countDocuments({ ...match, type: 'LIKE' })
    ])

    return {
        activeUsers,
        messages,
        posts,
        comments,
        aiUsage,
        stories,
        newUsers,
        likes,
        date: start
    }
}

// ============================================================
// STATISTIQUES DE LA SEMAINE
// ============================================================
async function getWeekStats() {
    const start = new Date()
    start.setDate(start.getDate() - 7)

    const [
        activeUsers,
        messages,
        posts,
        aiUsage,
        newUsers,
        comments,
        likes,
        stories
    ] = await Promise.all([
        User.countDocuments({ lastSeen: { $gte: start } }),
        Message.countDocuments({ createdAt: { $gte: start } }),
        Post.countDocuments({ createdAt: { $gte: start } }),
        Analytics.countDocuments({ type: 'AI_USE', createdAt: { $gte: start } }),
        User.countDocuments({ createdAt: { $gte: start } }),
        Analytics.countDocuments({ type: 'COMMENT', createdAt: { $gte: start } }),
        Analytics.countDocuments({ type: 'LIKE', createdAt: { $gte: start } }),
        Story.countDocuments({ createdAt: { $gte: start } })
    ])

    return {
        activeUsers,
        messages,
        posts,
        aiUsage,
        newUsers,
        comments,
        likes,
        stories,
        start
    }
}

// ============================================================
// STATISTIQUES DU MOIS
// ============================================================
async function getMonthStats() {
    const start = new Date()
    start.setDate(1)
    start.setHours(0, 0, 0, 0)

    const [
        activeUsers,
        messages,
        posts,
        aiUsage,
        newUsers
    ] = await Promise.all([
        User.countDocuments({ lastSeen: { $gte: start } }),
        Message.countDocuments({ createdAt: { $gte: start } }),
        Post.countDocuments({ createdAt: { $gte: start } }),
        Analytics.countDocuments({ type: 'AI_USE', createdAt: { $gte: start } }),
        User.countDocuments({ createdAt: { $gte: start } })
    ])

    return {
        activeUsers,
        messages,
        posts,
        aiUsage,
        newUsers,
        start
    }
}

// ============================================================
// CLASSEMENTS (7 derniers jours)
// ============================================================
async function getRankings() {
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    const [
        mostActiveUser,
        mostActiveGroup,
        topAiUser,
        topCoinsUser,
        topPoster
    ] = await Promise.all([
        Analytics.aggregate([
            { $match: { createdAt: { $gte: weekAgo } } },
            { $group: { _id: '$userId', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 1 },
            { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
            { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
            { $project: { nom: '$user.nom', count: 1 } }
        ]),
        Group.aggregate([
            { $lookup: { from: 'messages', localField: '_id', foreignField: 'groupe', as: 'msgs' } },
            { $addFields: { msgCount: { $size: '$msgs' } } },
            { $sort: { msgCount: -1 } },
            { $limit: 1 },
            { $project: { nom: 1, msgCount: 1 } }
        ]),
        Analytics.aggregate([
            { $match: { type: 'AI_USE', createdAt: { $gte: weekAgo } } },
            { $group: { _id: '$userId', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 1 },
            { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
            { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
            { $project: { nom: '$user.nom', count: 1 } }
        ]),
        User.find({}).sort({ walletBalance: -1 }).limit(1).select('nom walletBalance'),
        Post.aggregate([
            { $match: { createdAt: { $gte: weekAgo } } },
            { $group: { _id: '$auteur', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 1 },
            { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
            { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
            { $project: { nom: '$user.nom', count: 1 } }
        ])
    ])

    return {
        mostActiveUser: mostActiveUser[0] || { nom: 'Aucun', count: 0 },
        mostActiveGroup: mostActiveGroup[0] || { nom: 'Aucun', msgCount: 0 },
        topAiUser: topAiUser[0] || { nom: 'Aucun', count: 0 },
        topCoinsUser: topCoinsUser[0] || { nom: 'Aucun', walletBalance: 0 },
        topPoster: topPoster[0] || { nom: 'Aucun', count: 0 }
    }
}

// ============================================================
// ACTIVITÉ PAR HEURE
// ============================================================
async function getHourlyActivity() {
    const start = new Date()
    start.setHours(0, 0, 0, 0)

    const hours = []

    for (let i = 0; i < 24; i++) {
        const hStart = new Date(start)
        hStart.setHours(i, 0, 0, 0)

        const hEnd = new Date(start)
        hEnd.setHours(i, 59, 59, 999)

        const count = await Analytics.countDocuments({
            createdAt: { $gte: hStart, $lte: hEnd }
        })

        hours.push({ hour: i, count })
    }

    return hours
}

// ============================================================
// ACTIVITÉ PAR JOUR
// ============================================================
async function getDailyActivity(days = 7) {
    const result = []
    const today = new Date()

    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today)
        d.setDate(d.getDate() - i)
        d.setHours(0, 0, 0, 0)

        const dEnd = new Date(d)
        dEnd.setHours(23, 59, 59, 999)

        const count = await Analytics.countDocuments({
            createdAt: { $gte: d, $lte: dEnd }
        })

        result.push({
            date: d,
            count
        })
    }

    return result
}

module.exports = {
    track,
    updateLastSeen,
    getTodayStats,
    getWeekStats,
    getMonthStats,
    getRankings,
    getHourlyActivity,
    getDailyActivity
}
