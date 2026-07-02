const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")

const userSchema = new mongoose.Schema({
    nom: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    motDePasse: { type: String, required: true },
    bio: { type: String, default: "", maxlength: 200 },
    photoProfil: { type: String, default: "" },
    amis: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    demandesRecues: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    demandesEnvoyees: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    enLigne: { type: Boolean, default: false },
    derniereConnexion: { type: Date, default: Date.now },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    isDisabled: { type: Boolean, default: false },
    badges: [{
        type: {
            type: String,
            enum: ["verifie", "moderateur", "fondateur", "premium", "staff"],
            required: true
        },
        expiresAt: { type: Date, default: null }
    }],
    isBot: { type: Boolean, default: false },
    welcomeSent: { type: Boolean, default: false },

    // === GAMIFICATION ===
    xp: { type: Number, default: 0 },
    walletBalance: { type: Number, default: 0 },
    theme: {
        type: String,
        default: "default",
        enum: ["default", "dark", "neon", "ocean", "sunset", "forest", "cyberpunk", "rose", "galaxie", "minuit"]
    },

    // === CLONE IA ===
    aiCloneActive: { type: Boolean, default: false },
    aiCloneInstructions: { type: String, default: "" },
    aiCloneExpiry: { type: Date, default: null },

    // === BOUTIQUE ===
    xpBoostExpiry: { type: Date, default: null },
    profileTitle: { type: String, default: null },
    profileFrame: { type: String, default: null, enum: [null, "bronze", "argent", "or", "diamant"] },
    profileCover: { type: String, default: null },
    lastFreeCredits: { type: Date, default: null },

    // === ANIMATIONS DE PROFIL ===
    profileEffect: {
        type: String,
        default: null,
        enum: [null, "sparkle", "flame", "star", "diamond", "butterfly"]
    },

    // === RÉINITIALISATION DU MOT DE PASSE ===
    resetCode: {
        type: String,
        default: null
    },
    resetCodeExpires: {
        type: Date,
        default: null
    },

    // === QUESTION DE SÉCURITÉ ===
    securityQuestion: {
        type: String,
        default: null
    },
    securityAnswer: {
        type: String,
        default: null
    },

    // === CODES DE RÉCUPÉRATION ===
    recoveryCodes: {
        type: [String],
        default: []
    },

    // === SÉCURITÉ & INCOGNITO ===
    isIncognitoInput: { type: Boolean, default: false },
    activeSubProfile: { type: mongoose.Schema.Types.ObjectId, ref: "SubProfile", default: null },
    vaultedChats: { type: Map, of: String, default: {} },

    // === MODÉRATION AVANCÉE ===
    deletionReason: { type: String, default: null },
    disableReason: { type: String, default: null },
    disableContact: { type: String, default: null },

    restrictions: {
        messages: { until: { type: Date, default: null } },
        invitations: { until: { type: Date, default: null } },
        likes: { until: { type: Date, default: null } },
        posts: { until: { type: Date, default: null } }
    },

    warnings: [{
        motif: { type: String, required: true },
        createdAt: { type: Date, default: Date.now }
    }],

    // ============================================================
    // === ORACLE / ANALYTICS (PHASE 0) ===
    // ============================================================
    lastSeen: {
        type: Date,
        default: Date.now
    },

    // === ORACLE V2 — QUÊTES PERSONNALISÉES ===
    lastQuestGenerated: {
        type: Date,
        default: null
    },

    // === ABONNEMENTS ===
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // === PARAMÈTRES DE CONFIDENTIALITÉ ===
    hideOnlineStatus: { type: Boolean, default: false },
    allowMessagesFrom: { type: String, enum: ["all", "friends", "none"], default: "all" },
    showInSearch: { type: Boolean, default: true },

    // === BLOCAGE & PSEUDOS DE CONVERSATION ===
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    chatNicknames: { type: Map, of: String, default: {} }

}, { timestamps: true })

// ============================================================
// INDEXES — optimisation des requêtes les plus fréquentes
// ============================================================
userSchema.index({ nom: 1 })                          // recherche par nom
userSchema.index({ enLigne: 1 })                      // utilisateurs en ligne
userSchema.index({ lastSeen: -1 })                    // dernière activité
userSchema.index({ walletBalance: -1 })               // classement pièces
userSchema.index({ xp: -1 })                          // classement XP
userSchema.index({ role: 1 })                         // filtrage admins
userSchema.index({ showInSearch: 1, nom: 1 })         // recherche publique
userSchema.index({ createdAt: -1 })                   // nouveaux membres

userSchema.pre("save", async function(next) {
    if (!this.isModified("motDePasse")) return next()
    this.motDePasse = await bcrypt.hash(this.motDePasse, 10)
    next()
})

module.exports = mongoose.models.User || mongoose.model("User", userSchema)
