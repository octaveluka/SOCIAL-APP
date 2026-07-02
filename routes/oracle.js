const express = require("express")
const router = express.Router()
const { requireAuth } = require("../middleware/auth")
const { getOrCreateQuest, checkQuestProgress } = require("../lib/oracle")
const DailyQuest = require("../models/DailyQuest")
const User = require("../models/User")

function getStreakMultiplier(streak) {
    if (streak >= 30) return 3.0
    if (streak >= 14) return 2.5
    if (streak >= 7)  return 2.0
    if (streak >= 3)  return 1.5
    return 1.0
}

async function computeStreak(userId) {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().slice(0, 10)
    const yesterdayQuest = await DailyQuest.findOne({ userId, day: yesterdayStr })
    if (yesterdayQuest && yesterdayQuest.claimed) {
        return (yesterdayQuest.streak || 1) + 1
    }
    return 1
}

// GET — quête du jour + streak en champ top-level (pas virtuel Mongoose)
router.get("/api/oracle/quest", requireAuth, async (req, res) => {
    try {
        const quest = await getOrCreateQuest(req.session.user.id)
        const streak = quest.streak && quest.streak > 1
            ? quest.streak
            : await computeStreak(req.session.user.id)
        res.json({ success: true, quest: quest.toObject(), streak })
    } catch (err) {
        console.error("Oracle quest error:", err)
        res.status(500).json({ success: false, error: "Erreur serveur" })
    }
})

// POST — vérifier progression
router.post("/api/oracle/quest/verify", requireAuth, async (req, res) => {
    try {
        const quest = await checkQuestProgress(req.session.user.id)
        if (!quest) return res.json({ success: false, error: "Quête introuvable" })
        const streak = quest.streak && quest.streak > 1
            ? quest.streak
            : await computeStreak(req.session.user.id)
        res.json({ success: true, quest: quest.toObject(), streak })
    } catch (err) {
        console.error("Oracle verify error:", err)
        res.status(500).json({ success: false, error: "Erreur serveur" })
    }
})

// POST — réclamer la récompense
router.post("/api/oracle/quest/claim", requireAuth, async (req, res) => {
    try {
        const day = new Date().toISOString().slice(0, 10)
        const quest = await DailyQuest.findOne({ userId: req.session.user.id, day })
        if (!quest) return res.json({ success: false, error: "Quête introuvable" })
        if (quest.claimed) return res.json({ success: false, already: true, message: "Récompense déjà réclamée !" })
        if (!quest.completed) return res.json({ success: false, error: "Quête non terminée" })

        const streak = await computeStreak(req.session.user.id)
        const multiplier = getStreakMultiplier(streak)
        const baseCoins = quest.quest.reward.coins
        const baseXp = quest.quest.reward.xp
        const totalCoins = Math.round(baseCoins * multiplier)
        const bonusCoins = totalCoins - baseCoins

        quest.claimed = true
        quest.streak = streak
        quest.bonusCoins = bonusCoins
        await quest.save()

        await User.findByIdAndUpdate(req.session.user.id, {
            $inc: { walletBalance: totalCoins, xp: baseXp }
        })

        res.json({
            success: true,
            reward: { xp: baseXp, coins: baseCoins },
            streak,
            multiplier,
            bonusCoins,
            totalCoins
        })
    } catch (err) {
        console.error("Oracle claim error:", err)
        res.status(500).json({ success: false, error: "Erreur serveur" })
    }
})

// GET — historique des 7 derniers jours
router.get("/api/oracle/history", requireAuth, async (req, res) => {
    try {
        const days = []
        for (let i = 6; i >= 0; i--) {
            const d = new Date()
            d.setDate(d.getDate() - i)
            days.push(d.toISOString().slice(0, 10))
        }
        const quests = await DailyQuest.find({
            userId: req.session.user.id,
            day: { $in: days }
        }).lean()

        const map = {}
        quests.forEach(q => { map[q.day] = q })

        const history = days.map(day => ({
            day,
            quest: map[day] || null
        }))

        res.json({ success: true, history })
    } catch (err) {
        console.error("Oracle history error:", err)
        res.status(500).json({ success: false, error: "Erreur serveur" })
    }
})

module.exports = router
