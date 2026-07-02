const express = require("express")
const router = express.Router()
const { requireAuth } = require("../middleware/auth")
const User = require("../models/User")
const Bounty = require("../models/Bounty")
const Post = require("../models/Post")
const Message = require("../models/Message")
const { validateObjectId } = require("../lib/intrusionDetection")

const XP_THRESHOLDS = { bronze: 100, argent: 500, or: 2000, platine: 10000 }

const SHOP_ITEMS = [
    // === THÈMES VISUELS ===
    { id: "default",   name: "Thème Défaut",    price: 0,    type: "theme",   theme: "default",   emoji: "🎨", desc: "L'interface classique de SocialApp",            category: "Thèmes" },
    { id: "dark",      name: "Thème Nuit",       price: 200,  type: "theme",   theme: "dark",      emoji: "🌙", desc: "Interface sombre, parfaite pour la nuit",       category: "Thèmes" },
    { id: "ocean",     name: "Thème Océan",      price: 300,  type: "theme",   theme: "ocean",     emoji: "🌊", desc: "Ambiance marine fraîche et apaisante",           category: "Thèmes" },
    { id: "sunset",    name: "Thème Coucher",    price: 300,  type: "theme",   theme: "sunset",    emoji: "🌅", desc: "Tons chauds inspirés du coucher de soleil",      category: "Thèmes" },
    { id: "forest",    name: "Thème Forêt",      price: 300,  type: "theme",   theme: "forest",    emoji: "🌿", desc: "Palette naturelle et reposante",                 category: "Thèmes" },
    { id: "neon",      name: "Thème Néon",       price: 350,  type: "theme",   theme: "neon",      emoji: "⚡", desc: "Effets néon fluo ultra-lumineux",                category: "Thèmes" },
    { id: "rose",      name: "Thème Rose",       price: 350,  type: "theme",   theme: "rose",      emoji: "🌸", desc: "Palette douce et délicate façon cherry blossom", category: "Thèmes" },
    { id: "minuit",    name: "Thème Minuit",     price: 400,  type: "theme",   theme: "minuit",    emoji: "🌌", desc: "Noir profond avec accents bleutés",              category: "Thèmes" },
    { id: "cyberpunk", name: "Thème Cyberpunk",  price: 400,  type: "theme",   theme: "cyberpunk", emoji: "🤖", desc: "Interface futuriste style cyberpunk",            category: "Thèmes" },
    { id: "galaxie",   name: "Thème Galaxie",    price: 500,  type: "theme",   theme: "galaxie",   emoji: "🔮", desc: "Univers spatial mystérieux et profond",          category: "Thèmes" },

    // === BOOSTS XP ===
    { id: "xpboost_1d", name: "Boost XP 24h",   price: 300,  type: "xpboost", duration: 1,  emoji: "⚡", desc: "Double tes gains d'XP pendant 24 heures",      category: "Boosts" },
    { id: "xpboost_3d", name: "Boost XP 3 jours",price: 700,  type: "xpboost", duration: 3,  emoji: "🚀", desc: "Double tes gains d'XP pendant 3 jours",        category: "Boosts" },
    { id: "xpboost_7d", name: "Boost XP 7 jours",price: 1500, type: "xpboost", duration: 7,  emoji: "💥", desc: "Double tes gains d'XP pendant 7 jours entiers", category: "Boosts" },
    { id: "credits_50", name: "Pack 50 crédits",  price: 0,    type: "credits", amount: 50,   emoji: "💰", desc: "Offert ! Obtiens 50 crédits gratuits (1x/semaine)", category: "Boosts" },
    { id: "credits_pack", name: "Pack Richesse",   price: 2000, type: "credits", amount: 3000, emoji: "💎", desc: "Investis 2000 crédits pour en récupérer 3000 !", category: "Boosts" },

    // === TITRES DE PROFIL ===
    { id: "title_pro",     name: "Titre Pro",      price: 300,  type: "title",  value: "Pro",      emoji: "💼", desc: "Affiche 'Pro' sous ton nom de profil",          category: "Titres" },
    { id: "title_expert",  name: "Titre Expert",   price: 500,  type: "title",  value: "Expert",   emoji: "🎓", desc: "Affiche 'Expert' — statut reconnu",             category: "Titres" },
    { id: "title_vip",     name: "Titre VIP",      price: 700,  type: "title",  value: "VIP",      emoji: "⭐", desc: "Affiche 'VIP' en or sur ton profil",            category: "Titres" },
    { id: "title_elite",   name: "Titre Élite",    price: 1000, type: "title",  value: "Élite",    emoji: "🏅", desc: "Affiche 'Élite' — pour les meilleurs membres",  category: "Titres" },
    { id: "title_legende", name: "Titre Légende",  price: 2500, type: "title",  value: "Légende",  emoji: "🏆", desc: "Le titre ultime — réservé aux vrais legends",   category: "Titres" },

    // === CADRES D'AVATAR ===
    { id: "frame_bronze",  name: "Cadre Bronze",   price: 150,  type: "frame",  value: "bronze",  emoji: "🥉", desc: "Cadre bronze autour de ta photo de profil",     category: "Cadres" },
    { id: "frame_argent",  name: "Cadre Argent",   price: 400,  type: "frame",  value: "argent",  emoji: "🥈", desc: "Cadre argenté brillant",                        category: "Cadres" },
    { id: "frame_or",      name: "Cadre Or",       price: 800,  type: "frame",  value: "or",      emoji: "🥇", desc: "Cadre doré exclusif pour les membres sérieux",  category: "Cadres" },
    { id: "frame_diamant", name: "Cadre Diamant",  price: 2000, type: "frame",  value: "diamant", emoji: "💎", desc: "Cadre diamant ultra-rare — statut légendaire",  category: "Cadres" },

    // === BADGES SPÉCIAUX ===
    { id: "badge_premium", name: "Badge Premium",  price: 750,  type: "badge",  value: "premium", emoji: "👑", desc: "Débloque le badge Premium sur ton profil",       category: "Badges" },

    // ============================================================
    // === EFFETS DE PROFIL (AJOUT) ===
    // ============================================================
    { id: "effect_sparkle",  name: "Étincelles",    price: 500,  type: "effect", value: "sparkle",  emoji: "✨", desc: "Des étincelles autour de ton avatar",          category: "Effets" },
    { id: "effect_flame",    name: "Flammes",       price: 800,  type: "effect", value: "flame",    emoji: "🔥", desc: "Des flammes autour de ton nom",              category: "Effets" },
    { id: "effect_star",     name: "Étoiles",       price: 1200, type: "effect", value: "star",     emoji: "🌟", desc: "Des étoiles filantes sur ton profil",         category: "Effets" },
    { id: "effect_diamond",  name: "Diamant",       price: 2000, type: "effect", value: "diamond",  emoji: "💎", desc: "Effet diamant ultra-brillant",              category: "Effets" },
    { id: "effect_butterfly",name: "Papillons",     price: 2500, type: "effect", value: "butterfly",emoji: "🦋", desc: "Des papillons animés autour de toi",          category: "Effets" },

    // === CLONE IA ===
    { id: "clone_ia", name: "Clone IA", price: 1500, type: "clone", emoji: "🤖", desc: "Une IA répond en ton nom pendant 1 mois. Personnalise son style dans tes paramètres.", category: "IA" },
]

const BOUNTY_ACTION_TYPES = [
    { id: "like_post",    label: "👍 Liker ma dernière publication",        desc: "Va liker la dernière publication du créateur" },
    { id: "comment_post", label: "💬 Commenter une publication du créateur", desc: "Commente l'une des publications du créateur aujourd'hui" },
    { id: "add_friend",   label: "🤝 M'envoyer une demande d'ami",           desc: "Envoie une demande d'ami au créateur" },
    { id: "publish_post", label: "📝 Publier une actualité aujourd'hui",     desc: "Publie une actualité sur ton profil aujourd'hui" },
    { id: "use_ai",       label: "🤖 Utiliser une commande IA",              desc: "Utilise /+ ou /imagine dans n'importe quel chat" },
    { id: "send_5_msgs",  label: "✉️ Envoyer 5 messages dans les chats",     desc: "Envoie 5 messages dans les groupes ou en privé" },
    { id: "like_3_posts", label: "❤️ Liker 3 publications de la communauté", desc: "Aime 3 publications de n'importe quel utilisateur" },
    { id: "write_2_cmts", label: "✍️ Écrire 2 commentaires aujourd'hui",     desc: "Écris 2 commentaires sur des publications" },
    { id: "change_avatar",label: "🖼️ Modifier sa photo de profil",           desc: "Mets à jour ta photo de profil (confiance)" },
    { id: "join_group",   label: "👥 Rejoindre un groupe de la communauté",  desc: "Rejoins n'importe quel groupe ouvert" },
]

async function verifyBountyAction(userId, actionType, creatorId) {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    try {
        switch (actionType) {
            case "like_post": {
                const post = await Post.findOne({ auteur: creatorId }).sort({ createdAt: -1 })
                if (!post) return { ok: false, reason: "Le créateur n'a aucune publication." }
                return post.likes.some(id => id.toString() === userId)
                    ? { ok: true }
                    : { ok: false, reason: "Tu n'as pas encore liké la dernière publication du créateur." }
            }
            case "comment_post": {
                const posts = await Post.find({ auteur: creatorId })
                const done = posts.some(p => p.commentaires.some(c =>
                    c.auteur && c.auteur.toString() === userId && new Date(c.createdAt) >= today
                ))
                return done ? { ok: true } : { ok: false, reason: "Tu n'as pas commenté une publication du créateur aujourd'hui." }
            }
            case "add_friend": {
                const creator = await User.findById(creatorId)
                const ok = creator.amis.some(id => id.toString() === userId) ||
                           creator.demandesRecues.some(id => id.toString() === userId)
                return ok ? { ok: true } : { ok: false, reason: "Tu n'as pas encore envoyé de demande d'ami au créateur." }
            }
            case "publish_post": {
                const count = await Post.countDocuments({ auteur: userId, createdAt: { $gte: today } })
                return count >= 1 ? { ok: true } : { ok: false, reason: "Tu n'as pas encore publié d'actualité aujourd'hui." }
            }
            case "use_ai": {
                const count = await Message.countDocuments({ expediteur: userId, contenu: { $regex: /^\/[a-z+]/i }, createdAt: { $gte: today } })
                return count >= 1 ? { ok: true } : { ok: false, reason: "Tu n'as pas encore utilisé de commande IA aujourd'hui." }
            }
            case "send_5_msgs": {
                const count = await Message.countDocuments({ expediteur: userId, createdAt: { $gte: today } })
                return count >= 5 ? { ok: true } : { ok: false, reason: `Tu as envoyé ${count}/5 messages aujourd'hui.` }
            }
            case "like_3_posts": {
                const count = await Post.countDocuments({ likes: userId })
                return count >= 3 ? { ok: true } : { ok: false, reason: `Tu as liké ${count}/3 publications.` }
            }
            case "write_2_cmts": {
                const posts = await Post.find({ "commentaires.auteur": userId })
                const count = posts.reduce((acc, p) => acc + p.commentaires.filter(c =>
                    c.auteur && c.auteur.toString() === userId && new Date(c.createdAt) >= today
                ).length, 0)
                return count >= 2 ? { ok: true } : { ok: false, reason: `Tu as écrit ${count}/2 commentaires aujourd'hui.` }
            }
            case "change_avatar":
            case "join_group":
                return { ok: true }
            default:
                return { ok: false, reason: "Type d'action inconnu." }
        }
    } catch (e) {
        return { ok: false, reason: "Erreur de vérification." }
    }
}

// Page portefeuille
router.get("/wallet", requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id)
        res.render("wallet", { title: "Portefeuille", currentPage: "wallet", user, xpThresholds: XP_THRESHOLDS })
    } catch (err) { console.error(err); res.redirect("/") }
})

// Page boutique
router.get("/shop", requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id)
        res.render("shop", { title: "Boutique", currentPage: "shop", user, shopItems: SHOP_ITEMS })
    } catch (err) { console.error(err); res.redirect("/") }
})

// Acheter un article
router.post("/api/shop/buy", requireAuth, async (req, res) => {
    try {
        const { itemId } = req.body
        let user = await User.findById(req.session.user.id)
        const item = SHOP_ITEMS.find(i => i.id === itemId)
        if (!item) return res.status(404).json({ error: "Article introuvable." })

        // FIX-11: déduction atomique du solde pour éviter le double-spend
        if (item.id === "credits_50") {
            // Pack gratuit : vérification + marquage atomique en une seule opération
            const oneWeekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000)
            const claimed = await User.findOneAndUpdate(
                {
                    _id: user._id,
                    $or: [
                        { lastFreeCredits: null },
                        { lastFreeCredits: { $exists: false } },
                        { lastFreeCredits: { $lte: oneWeekAgo } }
                    ]
                },
                { $set: { lastFreeCredits: new Date() } },
                { new: true }
            )
            if (!claimed) {
                return res.status(400).json({ error: "Tu as déjà réclamé ce bonus cette semaine. Reviens dans 7 jours !" })
            }
            user = claimed
        } else if (item.price > 0 && user.role !== "admin") {
            // Déduction atomique : échoue si le solde est insuffisant
            const deducted = await User.findOneAndUpdate(
                { _id: user._id, walletBalance: { $gte: item.price } },
                { $inc: { walletBalance: -item.price } },
                { new: true }
            )
            if (!deducted) {
                return res.status(402).json({ error: `Solde insuffisant (${user.walletBalance} crédits, besoin de ${item.price}).` })
            }
            user = deducted
        }

        let result = {}

        if (item.type === "theme") {
            if (user.theme === item.theme) return res.json({ success: true, message: "Thème déjà actif !" })
            user.theme = item.theme
            req.session.user.theme = item.theme
            result = { theme: item.theme }

        } else if (item.type === "xpboost") {
            const now = new Date()
            const current = user.xpBoostExpiry && user.xpBoostExpiry > now ? user.xpBoostExpiry : now
            user.xpBoostExpiry = new Date(current.getTime() + item.duration * 24 * 3600 * 1000)
            result = { xpBoostExpiry: user.xpBoostExpiry }

        } else if (item.type === "title") {
            user.profileTitle = item.value
            result = { profileTitle: item.value }

        } else if (item.type === "frame") {
            user.profileFrame = item.value
            result = { profileFrame: item.value }

        } else if (item.type === "badge") {
            const now = new Date()
            const existing = user.badges.find(b => b.type === item.value)
            if (existing && existing.expiresAt && existing.expiresAt > now) {
                existing.expiresAt = new Date(existing.expiresAt.getTime() + 14 * 24 * 3600 * 1000)
            } else if (existing && (!existing.expiresAt || existing.expiresAt <= now)) {
                existing.expiresAt = new Date(Date.now() + 14 * 24 * 3600 * 1000)
            } else {
                user.badges.push({ type: item.value, expiresAt: new Date(Date.now() + 14 * 24 * 3600 * 1000) })
            }
            result = { badge: item.value, expiresAt: existing ? existing.expiresAt : user.badges[user.badges.length - 1].expiresAt }

        } else if (item.type === "credits") {
            user.walletBalance += item.amount
            if (item.id === "credits_50") user.lastFreeCredits = new Date()
            result = { creditsGained: item.amount }

        // ============================================================
        // === EFFET DE PROFIL ===
        // ============================================================
        } else if (item.type === "effect") {
            if (user.profileEffect === item.value) {
                return res.json({ success: true, message: "Effet déjà actif !" })
            }
            user.profileEffect = item.value
            req.session.user.profileEffect = item.value
            result = { profileEffect: item.value }

        // ============================================================
        // === CLONE IA ===
        // ============================================================
        } else if (item.type === "clone") {
            // Si déjà actif, prolonger d'un mois
            const now = new Date()
            const current = user.aiCloneExpiry && user.aiCloneExpiry > now ? user.aiCloneExpiry : now
            user.aiCloneExpiry = new Date(current.getTime() + 30 * 24 * 3600 * 1000)
            user.aiCloneActive = true
            result = { aiCloneExpiry: user.aiCloneExpiry }
        }

        await user.save()
        res.json({ success: true, balance: user.walletBalance, ...result })
    } catch (err) { console.error(err); res.status(500).json({ error: "Erreur serveur." }) }
})

// Page primes
router.post("/api/shop/unequip", requireAuth, async (req, res) => {
    try {
        const { field } = req.body
        const allowed = ["profileTitle", "profileFrame", "profileEffect"]
        if (!allowed.includes(field)) return res.status(400).json({ error: "Champ invalide." })
        const user = await User.findById(req.session.user.id)
        if (!user) return res.status(404).json({ error: "Utilisateur introuvable." })
        user[field] = null
        if (field === "profileEffect") req.session.user.profileEffect = null
        if (field === "profileTitle") req.session.user.profileTitle = null
        if (field === "profileFrame") req.session.user.profileFrame = null
        await user.save()
        res.json({ success: true })
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: "Erreur serveur." })
    }
})

router.get("/bounties", requireAuth, async (req, res) => {
    try {
        const bounties = await Bounty.find()
            .populate("createdBy", "nom photoProfil badges")
            .populate("applicants.user", "nom photoProfil")
            .sort({ createdAt: -1 })
        const user = await User.findById(req.session.user.id)
        res.render("bounties", {
            title: "Primes",
            currentPage: "bounties",
            bounties,
            user,
            actionTypes: BOUNTY_ACTION_TYPES
        })
    } catch (err) { console.error(err); res.redirect("/") }
})

// Créer une prime
router.post("/api/bounties", requireAuth, async (req, res) => {
    try {
        const { actionType, customTitle, customDescription, rewardAmount } = req.body
        const user = await User.findById(req.session.user.id)
        const amount = parseInt(rewardAmount)
        if (!amount || amount < 1) return res.status(400).json({ error: "Montant minimum : 1 crédit." })
        // FIX-13: plafond du montant d'une prime
        if (amount > 10000) return res.status(400).json({ error: "Montant maximum : 10 000 crédits." })

        let title, description, bountyActionType

        if (customTitle && user.role === "admin") {
            title = customTitle.trim().slice(0, 80)
            description = (customDescription || "").trim().slice(0, 200)
            bountyActionType = "custom_admin"
        } else {
            const action = BOUNTY_ACTION_TYPES.find(a => a.id === actionType)
            if (!action) return res.status(400).json({ error: "Type d'action invalide." })
            title = action.label
            description = action.desc
            bountyActionType = actionType
        }

        if (user.role !== "admin" && user.walletBalance < amount) {
            return res.status(402).json({ error: `Solde insuffisant (${user.walletBalance} crédits).` })
        }
        if (user.role !== "admin") {
            user.walletBalance -= amount
            await user.save()
        }
        const bounty = await Bounty.create({
            title,
            description,
            actionType: bountyActionType,
            rewardAmount: amount,
            createdBy: user._id
        })
        res.json({ success: true, bounty })
    } catch (err) { console.error(err); res.status(500).json({ error: "Erreur serveur." }) }
})

// API : primes actives
router.get("/api/bounties/active", requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id
        const bounties = await Bounty.find({ status: "open" })
            .populate("createdBy", "nom photoProfil")
            .sort({ createdAt: -1 })
            .limit(20)
        const withStatus = bounties.map(b => ({
            _id: b._id,
            title: b.title,
            description: b.description,
            actionType: b.actionType,
            rewardAmount: b.rewardAmount,
            creatorNom: b.createdBy?.nom,
            creatorId: b.createdBy?._id,
            applicantsCount: b.applicants.length,
            isOwn: b.createdBy?._id.toString() === userId,
            alreadyApplied: b.applicants.some(a => a.user?.toString() === userId)
        }))
        res.json({ success: true, bounties: withStatus })
    } catch (err) { res.status(500).json({ success: false, error: "Erreur serveur." }) }
})

// API : voir les candidats d'une prime
router.get("/api/bounties/:id/applicants", requireAuth, async (req, res) => {
    try {
        const bounty = await Bounty.findById(req.params.id)
            .populate("createdBy", "nom")
            .populate("applicants.user", "nom photoProfil")
        if (!bounty) return res.status(404).json({ error: "Prime introuvable." })
        if (bounty.createdBy._id.toString() !== req.session.user.id) {
            return res.status(403).json({ error: "Accès refusé." })
        }
        res.json({ success: true, applicants: bounty.applicants, bountyId: bounty._id })
    } catch (err) { res.status(500).json({ error: "Erreur serveur." }) }
})

// Accomplir une prime
router.post("/api/bounties/:id/accomplish", requireAuth, validateObjectId(), async (req, res) => {
    try {
        const bounty = await Bounty.findById(req.params.id).populate("createdBy", "_id nom")
        if (!bounty || bounty.status !== "open") {
            return res.status(400).json({ ok: false, reason: "Prime fermée ou introuvable." })
        }
        const userId = req.session.user.id
        if (bounty.createdBy._id.toString() === userId) {
            return res.status(400).json({ ok: false, reason: "Tu ne peux pas accomplir ta propre prime." })
        }
        if (bounty.applicants.some(a => a.user?.toString() === userId)) {
            return res.json({ ok: false, reason: "Tu as déjà postulé à cette prime." })
        }
        const result = await verifyBountyAction(userId, bounty.actionType, bounty.createdBy._id.toString())
        if (!result.ok) return res.json({ ok: false, reason: result.reason })

        // FIX-12: claim atomique pour éviter le double-spend sur les primes concurrentes
        const claimed = await Bounty.findOneAndUpdate(
            { _id: req.params.id, status: "open" },
            {
                $set: { status: "claimed", claimedBy: userId },
                $push: { applicants: { user: userId, verified: true, message: "Auto-vérifié", submittedAt: new Date() } }
            },
            { new: true }
        ).populate("createdBy", "_id nom")

        if (!claimed) {
            return res.json({ ok: false, reason: "Cette prime vient d'être réclamée par quelqu'un d'autre." })
        }

        // Mise à jour atomique du portefeuille
        await User.findByIdAndUpdate(userId, {
            $inc: { walletBalance: claimed.rewardAmount, xp: Math.ceil(claimed.rewardAmount * 10) }
        })

        res.json({ ok: true, reward: claimed.rewardAmount, creatorNom: claimed.createdBy.nom })
    } catch (err) { console.error(err); res.status(500).json({ ok: false, reason: "Erreur serveur." }) }
})

// Attribuer manuellement une prime
router.post("/api/bounties/:id/award/:userId", requireAuth, validateObjectId(), validateObjectId("userId"), async (req, res) => {
    try {
        const bounty = await Bounty.findById(req.params.id)
        if (!bounty) return res.status(404).json({ error: "Prime introuvable." })
        const user = await User.findById(req.session.user.id)
        if (bounty.createdBy.toString() !== req.session.user.id && user.role !== "admin") {
            return res.status(403).json({ error: "Seul le créateur ou un admin peut attribuer." })
        }
        if (bounty.status !== "open") return res.status(400).json({ error: "Prime déjà fermée." })
        const winner = await User.findById(req.params.userId)
        if (!winner) return res.status(404).json({ error: "Utilisateur introuvable." })
        // FIX-14: vérifier que le destinataire a bien postulé à cette prime
        const isApplicant = bounty.applicants.some(a => a.user?.toString() === req.params.userId)
        const isAdmin = user.role === "admin"
        if (!isApplicant && !isAdmin) {
            return res.status(400).json({ error: "Cet utilisateur n'a pas postulé à cette prime." })
        }
        await User.findByIdAndUpdate(winner._id, { $inc: { walletBalance: bounty.rewardAmount, xp: bounty.rewardAmount * 10 } })
        bounty.status = "claimed"
        bounty.claimedBy = winner._id
        await bounty.save()
        res.json({ success: true, winner: winner.nom })
    } catch (err) { console.error(err); res.status(500).json({ error: "Erreur serveur." }) }
})

// Activer/désactiver le clone IA (nécessite un abonnement valide via la boutique)
router.post("/api/clone/toggle", requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id)
        const hasAccess = user.aiCloneExpiry && user.aiCloneExpiry > new Date()
        if (!hasAccess) {
            return res.status(403).json({ success: false, error: "Abonnement Clone IA requis. Achète-le en boutique." })
        }
        user.aiCloneActive = !user.aiCloneActive
        await user.save()
        res.json({ success: true, active: user.aiCloneActive })
    } catch (err) { res.status(500).json({ error: "Erreur serveur." }) }
})

// Sauvegarder les instructions du clone IA
router.post("/api/clone/instructions", requireAuth, async (req, res) => {
    try {
        const { instructions } = req.body
        const user = await User.findById(req.session.user.id)
        user.aiCloneInstructions = (instructions || "").slice(0, 500)
        await user.save()
        res.json({ success: true })
    } catch (err) { res.status(500).json({ error: "Erreur serveur." }) }
})

// API solde et XP
router.get("/api/wallet/me", requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id, "walletBalance xp theme role aiCloneActive xpBoostExpiry profileTitle profileFrame profileEffect") // ← AJOUT : profileEffect
        const boostActive = user.xpBoostExpiry && user.xpBoostExpiry > new Date()
        res.json({
            balance: user.walletBalance,
            xp: user.xp,
            theme: user.theme,
            role: user.role,
            aiCloneActive: user.aiCloneActive,
            boostActive,
            xpBoostExpiry: user.xpBoostExpiry,
            profileTitle: user.profileTitle,
            profileFrame: user.profileFrame,
            profileEffect: user.profileEffect // ← AJOUT
        })
    } catch (err) { res.status(500).json({ error: "Erreur serveur." }) }
})

module.exports = router
module.exports.BOUNTY_ACTION_TYPES = BOUNTY_ACTION_TYPES
