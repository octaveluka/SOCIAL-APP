const Post = require("../models/Post")
const Message = require("../models/Message")
const Story = require("../models/Story")
const Analytics = require("../models/Analytics")
const Notification = require("../models/Notification")
const DailyQuest = require("../models/DailyQuest")

function getTodayStr() {
    return new Date().toISOString().slice(0, 10)
}

function getTodayStart() {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
}

// ============================================================
// TEMPLATES — 10 quêtes variées couvrant toutes les fonctions
// Fix AI : utilise Analytics (les /commandes ne sont pas sauvegardées en DB)
// Fix Like : utilise Analytics (pas de timestamp sur le tableau likes)
// ============================================================
const QUEST_TEMPLATES = [

    // ===== CONTENU =====
    {
        type: "post",
        text: "Publie une publication aujourd'hui",
        emoji: "✍️",
        targetCount: 1,
        reward: { xp: 60, coins: 60 },
        check: async (userId, today) =>
            Analytics.countDocuments({ userId, type: "POST", createdAt: { $gte: today } })
    },
    {
        type: "story",
        text: "Publie une story aujourd'hui",
        emoji: "📸",
        targetCount: 1,
        reward: { xp: 65, coins: 65 },
        check: async (userId, today) =>
            Story.countDocuments({ auteur: userId, createdAt: { $gte: today } })
    },
    {
        type: "share",
        text: "Partage une publication avec un message",
        emoji: "🔄",
        targetCount: 1,
        reward: { xp: 55, coins: 55 },
        check: async (userId, today) =>
            Post.countDocuments({ auteur: userId, isShared: true, createdAt: { $gte: today } })
    },
    {
        type: "double_post",
        text: "Publie 2 publications aujourd'hui",
        emoji: "🔥",
        targetCount: 2,
        reward: { xp: 90, coins: 90 },
        check: async (userId, today) =>
            Analytics.countDocuments({ userId, type: "POST", createdAt: { $gte: today } })
    },

    // ===== ENGAGEMENT =====
    {
        type: "like",
        text: "Aime 5 publications aujourd'hui",
        emoji: "❤️",
        targetCount: 5,
        reward: { xp: 50, coins: 50 },
        check: async (userId, today) =>
            Analytics.countDocuments({ userId, type: "LIKE", createdAt: { $gte: today } })
    },
    {
        type: "comment",
        text: "Commente 3 publications aujourd'hui",
        emoji: "💬",
        targetCount: 3,
        reward: { xp: 60, coins: 65 },
        check: async (userId, today) =>
            Analytics.countDocuments({ userId, type: "COMMENT", createdAt: { $gte: today } })
    },
    {
        type: "like_big",
        text: "Aime 10 publications aujourd'hui",
        emoji: "💖",
        targetCount: 10,
        reward: { xp: 75, coins: 80 },
        check: async (userId, today) =>
            Analytics.countDocuments({ userId, type: "LIKE", createdAt: { $gte: today } })
    },

    // ===== SOCIAL =====
    {
        type: "message",
        text: "Envoie 10 messages à tes amis",
        emoji: "📨",
        targetCount: 10,
        reward: { xp: 50, coins: 50 },
        check: async (userId, today) =>
            Message.countDocuments({
                expediteur: userId,
                destinataire: { $exists: true, $ne: null },
                groupe: null,
                createdAt: { $gte: today }
            })
    },
    {
        type: "group_message",
        text: "Envoie 5 messages dans un groupe",
        emoji: "👥",
        targetCount: 5,
        reward: { xp: 55, coins: 55 },
        check: async (userId, today) =>
            Message.countDocuments({
                expediteur: userId,
                groupe: { $exists: true, $ne: null },
                createdAt: { $gte: today }
            })
    },
    {
        type: "friend_request",
        text: "Envoie une demande d'ami aujourd'hui",
        emoji: "🤝",
        targetCount: 1,
        reward: { xp: 50, coins: 50 },
        check: async (userId, today) =>
            Notification.countDocuments({
                expediteur: userId,
                type: "demande_ami",
                createdAt: { $gte: today }
            })
    },

    // ===== IA =====
    {
        type: "ai",
        text: "Utilise une commande IA aujourd'hui (/+, /imagine…)",
        emoji: "🤖",
        targetCount: 1,
        reward: { xp: 70, coins: 70 },
        // FIX : les /commandes ne sont JAMAIS sauvegardées en contenu — on utilise Analytics
        check: async (userId, today) =>
            Analytics.countDocuments({ userId, type: "AI_USE", createdAt: { $gte: today } })
    },
    {
        type: "ai_pro",
        text: "Utilise 3 commandes IA aujourd'hui",
        emoji: "🧠",
        targetCount: 3,
        reward: { xp: 100, coins: 100 },
        check: async (userId, today) =>
            Analytics.countDocuments({ userId, type: "AI_USE", createdAt: { $gte: today } })
    },

    // ===== CONNEXION =====
    {
        type: "login",
        text: "Connecte-toi sur SocialApp aujourd'hui",
        emoji: "🌟",
        targetCount: 1,
        reward: { xp: 30, coins: 50 },
        check: async () => 1 // Toujours accomplie dès l'ouverture du feed
    },
]

// ============================================================
// ANALYSE D'ACTIVITÉ UTILISATEUR (pour choisir la bonne quête)
// ============================================================
async function analyzeUserActivity(userId) {
    const today = getTodayStart()
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

    const [postsToday, messagesToday, storiesRecent, aiToday, likesToday, commentsToday] = await Promise.all([
        Analytics.countDocuments({ userId, type: "POST", createdAt: { $gte: today } }),
        Message.countDocuments({ expediteur: userId, createdAt: { $gte: today } }),
        Story.countDocuments({ auteur: userId, createdAt: { $gte: sevenDaysAgo } }),
        Analytics.countDocuments({ userId, type: "AI_USE", createdAt: { $gte: today } }),
        Analytics.countDocuments({ userId, type: "LIKE", createdAt: { $gte: today } }),
        Analytics.countDocuments({ userId, type: "COMMENT", createdAt: { $gte: today } })
    ])

    return { postsToday, messagesToday, storiesRecent, aiToday, likesToday, commentsToday }
}

// ============================================================
// CRÉER OU RÉCUPÉRER LA QUÊTE DU JOUR
// ============================================================
async function getOrCreateQuest(userId) {
    const day = getTodayStr()

    const existing = await DailyQuest.findOne({ userId, day })
    if (existing) return existing

    const today = getTodayStart()

    // Évaluer toutes les quêtes disponibles (non encore accomplies)
    const available = []
    for (const t of QUEST_TEMPLATES) {
        try {
            const progress = await t.check(userId, today)
            if (progress < t.targetCount) {
                available.push({ ...t, currentProgress: progress })
            }
        } catch (e) {
            console.error(`Oracle check error (${t.type}):`, e.message)
        }
    }

    let chosen
    if (available.length === 0) {
        // Toutes les quêtes sont déjà accomplies — bonus
        chosen = {
            type: "post",
            emoji: "🏆",
            text: "Incroyable — tu es au max ! Publie encore pour scorer davantage",
            targetCount: 99,
            reward: { xp: 100, coins: 100 },
            currentProgress: 0
        }
    } else {
        // Prioriser les quêtes de login en premier si non faites
        const loginQuest = available.find(t => t.type === "login")
        if (loginQuest) {
            chosen = loginQuest
        } else {
            // Sélection aléatoire parmi les disponibles
            chosen = available[Math.floor(Math.random() * available.length)]
        }
    }

    const expiresAt = new Date()
    expiresAt.setHours(23, 59, 59, 999)

    const quest = await DailyQuest.create({
        userId,
        day,
        quest: {
            text: (chosen.emoji ? chosen.emoji + " " : "") + chosen.text,
            type: chosen.type,
            targetCount: chosen.targetCount,
            reward: chosen.reward
        },
        progress: Math.min(chosen.currentProgress || 0, chosen.targetCount),
        completed: (chosen.currentProgress || 0) >= chosen.targetCount,
        expiresAt
    })

    return quest
}

// ============================================================
// VÉRIFIER LA PROGRESSION D'UNE QUÊTE EN COURS
// ============================================================
async function checkQuestProgress(userId) {
    const day = getTodayStr()
    const quest = await DailyQuest.findOne({ userId, day })
    if (!quest || quest.claimed) return quest

    const today = getTodayStart()
    const template = QUEST_TEMPLATES.find(t => t.type === quest.quest.type)
    if (!template) return quest

    try {
        const progress = await template.check(userId, today)
        quest.progress = Math.min(progress, quest.quest.targetCount)
        if (quest.progress >= quest.quest.targetCount) {
            quest.completed = true
        }
        await quest.save()
    } catch (e) {
        console.error("Oracle checkProgress error:", e.message)
    }

    return quest
}

module.exports = { getOrCreateQuest, checkQuestProgress, analyzeUserActivity }
