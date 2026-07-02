const express = require("express")
const router = express.Router()
const { requireAuth } = require("../middleware/auth")
const DailyTask = require("../models/DailyTask")
const User = require("../models/User")
const Post = require("../models/Post")
const Message = require("../models/Message")

const TASK_TEMPLATES = [
    { title: "👍 Aimeur du jour",     description: "Aimer au moins 3 publications",           taskType: "like",         targetCount: 3,  reward: 10, xpReward: 5  },
    { title: "💬 Commentateur",        description: "Commenter 1 publication",                  taskType: "comment",      targetCount: 1,  reward: 15, xpReward: 8  },
    { title: "📝 Auteur du jour",      description: "Publier 1 actualité",                      taskType: "post",         targetCount: 1,  reward: 20, xpReward: 10 },
    { title: "✉️ Communicateur",       description: "Envoyer 5 messages dans les chats",        taskType: "message",      targetCount: 5,  reward: 10, xpReward: 5  },
    { title: "🌅 Connexion du jour",   description: "Te connecter sur SocialApp aujourd'hui",   taskType: "login",        targetCount: 1,  reward: 5,  xpReward: 3  },
    { title: "🤖 Explorateur IA",      description: "Utiliser 1 commande IA (/+, /imagine…)",   taskType: "ai_command",   targetCount: 1,  reward: 15, xpReward: 8  },
    { title: "😍 Réacteur",            description: "Réagir à 2 messages avec un émoji",        taskType: "react",        targetCount: 2,  reward: 10, xpReward: 5  },
    { title: "🤝 Sociable",            description: "Envoyer 1 demande d'ami",                  taskType: "friend_req",   targetCount: 1,  reward: 15, xpReward: 8  },
    { title: "🖼️ Créatif",             description: "Envoyer une image dans un chat",           taskType: "send_image",   targetCount: 1,  reward: 20, xpReward: 10 },
    { title: "🎯 Connecté actif",      description: "Envoyer 10 messages aujourd'hui",          taskType: "message",      targetCount: 10, reward: 25, xpReward: 15 },
]

function getTodayStr() {
    return new Date().toISOString().slice(0, 10)
}

async function generateDailyTasks() {
    const day = getTodayStr()
    const existing = await DailyTask.countDocuments({ day })
    if (existing >= 10) return
    await DailyTask.deleteMany({ day })
    const expiresAt = new Date()
    expiresAt.setHours(23, 59, 59, 999)
    const docs = TASK_TEMPLATES.map(t => ({ ...t, day, expiresAt }))
    await DailyTask.insertMany(docs)
    console.log("✅ 10 tâches journalières générées pour", day)
}

router.get("/api/daily-tasks", requireAuth, async (req, res) => {
    try {
        await generateDailyTasks()
        const day = getTodayStr()
        const tasks = await DailyTask.find({ day }).lean()
        const userId = req.session.user.id
        const withStatus = tasks.map(t => ({
            ...t,
            done: t.completions.some(c => c.userId.toString() === userId)
        }))
        res.json({ success: true, tasks: withStatus })
    } catch (err) {
        console.error(err)
        res.status(500).json({ success: false, error: "Erreur serveur" })
    }
})

router.post("/api/daily-tasks/:id/verify", requireAuth, async (req, res) => {
    try {
        const task = await DailyTask.findById(req.params.id)
        if (!task) return res.status(404).json({ verified: false, error: "Tâche introuvable" })
        const userId = req.session.user.id
        if (task.completions.some(c => c.userId.toString() === userId)) {
            return res.json({ verified: false, already: true, message: "Déjà réclamé !" })
        }
        const today = new Date(); today.setHours(0, 0, 0, 0)
        let verified = false

        switch (task.taskType) {
            case "login":
                verified = true
                break
            case "like": {
                const count = await Post.countDocuments({ likes: userId })
                verified = count >= task.targetCount
                break
            }
            case "post": {
                const count = await Post.countDocuments({ auteur: userId, createdAt: { $gte: today } })
                verified = count >= task.targetCount
                break
            }
            case "comment": {
                const posts = await Post.find({ "commentaires.auteur": userId })
                const count = posts.filter(p => p.commentaires.some(c =>
                    c.auteur && c.auteur.toString() === userId && new Date(c.createdAt) >= today
                )).length
                verified = count >= task.targetCount
                break
            }
            case "message": {
                const count = await Message.countDocuments({ expediteur: userId, createdAt: { $gte: today } })
                verified = count >= task.targetCount
                break
            }
            case "ai_command": {
                const count = await Message.countDocuments({
                    expediteur: userId,
                    contenu: { $regex: /^\/[+a-z]/i },
                    createdAt: { $gte: today }
                })
                verified = count >= task.targetCount
                break
            }
            case "react": {
                const count = await Message.countDocuments({
                    "reactions.userId": userId,
                    updatedAt: { $gte: today }
                })
                verified = count >= task.targetCount
                break
            }
            case "friend_req":
            case "send_image":
                verified = true
                break
            default:
                verified = false
        }

        res.json({ verified, reward: task.reward, xp: task.xpReward })
    } catch (err) {
        console.error(err)
        res.status(500).json({ verified: false, error: "Erreur serveur" })
    }
})

router.post("/api/daily-tasks/:id/claim", requireAuth, async (req, res) => {
    try {
        const task = await DailyTask.findById(req.params.id)
        if (!task) return res.status(404).json({ success: false, error: "Tâche introuvable" })
        const userId = req.session.user.id
        if (task.completions.some(c => c.userId.toString() === userId)) {
            return res.json({ success: false, already: true, message: "Déjà réclamé !" })
        }
        task.completions.push({ userId, completedAt: new Date() })
        await task.save()
        await User.findByIdAndUpdate(userId, {
            $inc: { walletBalance: task.reward, xp: task.xpReward }
        })
        res.json({ success: true, reward: task.reward, xp: task.xpReward })
    } catch (err) {
        console.error(err)
        res.status(500).json({ success: false, error: "Erreur serveur" })
    }
})

module.exports = router
module.exports.generateDailyTasks = generateDailyTasks
