const SecurityEvent = require("../models/SecurityEvent")

// In-memory counters — ip -> { count, firstAttempt, lastAttempt, emails }
const loginFailures = new Map()
const socketEvents = new Map()

// Seuil de ban automatique (configurable)
const AUTO_BAN_THRESHOLD = 10       // tentatives avant ban
const AUTO_BAN_DURATION_H = 24      // heures de ban automatique

// ============================================================
// Utilitaire : extraire l'IP réelle derrière un proxy Replit
// ============================================================
function getIp(req) {
    return (
        (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
        req.socket?.remoteAddress ||
        "unknown"
    )
}

// ============================================================
// Alerter les admins via Socket.io
// ============================================================
function alertAdmins(type, message, details = null) {
    if (global.io) {
        global.io.emit("security-alert", {
            type,
            message,
            details,
            timestamp: new Date().toISOString()
        })
    }
}

// ============================================================
// 1. Enregistrer une tentative de connexion échouée
//    + ban automatique si seuil atteint
// ============================================================
async function recordFailedLogin(req, email) {
    const ip = getIp(req)
    const userAgent = req.headers["user-agent"] || null
    const now = Date.now()

    // Persister en base
    try {
        await SecurityEvent.create({
            type: "failed_login",
            ip,
            email: email || null,
            userAgent,
            details: `Tentative échouée pour : ${email || "inconnu"}`
        })
    } catch (_) {}

    // Compteur en mémoire
    const entry = loginFailures.get(ip) || { count: 0, firstAttempt: now, emails: new Set() }
    entry.count++
    entry.lastAttempt = now
    if (email) entry.emails.add(email)
    loginFailures.set(ip, entry)

    const fiveMin = 5 * 60 * 1000

    // Alerte brute-force à partir de 5 échecs en 5 min
    if (entry.count === 5 && (now - entry.firstAttempt) <= fiveMin) {
        try {
            await SecurityEvent.create({
                type: "brute_force",
                ip,
                email: email || null,
                userAgent,
                details: `${entry.count} tentatives échouées depuis ${ip} en moins de 5 minutes (emails: ${[...entry.emails].join(", ")})`
            })
        } catch (_) {}

        alertAdmins(
            "brute_force",
            `🚨 Brute-force détecté depuis ${ip}`,
            `${entry.count} tentatives de connexion échouées en moins de 5 min${email ? ` (dernier email : ${email})` : ""}`
        )
    }

    // Ban automatique à partir de AUTO_BAN_THRESHOLD échecs
    if (entry.count >= AUTO_BAN_THRESHOLD) {
        await autoBanIP(ip, `Brute-force automatique : ${entry.count} tentatives échouées`, AUTO_BAN_DURATION_H)
        loginFailures.delete(ip)
    }
}

// ============================================================
// 2. Ban automatique d'une IP
// ============================================================
async function autoBanIP(ip, reason = "Brute-force automatique", hours = 24) {
    if (!ip || ip === "unknown") return
    try {
        const IPBan = require("../models/IPBan")
        const bannedUntil = new Date(Date.now() + hours * 3600 * 1000)
        await IPBan.findOneAndUpdate(
            { ip },
            {
                $set: { reason, bannedUntil, bannedAt: new Date() },
                $inc: { triggerCount: 1 }
            },
            { upsert: true, new: true }
        )
        alertAdmins(
            "brute_force",
            `🔒 IP bannie automatiquement : ${ip}`,
            `${reason} — ban de ${hours}h jusqu'au ${bannedUntil.toLocaleString("fr-FR")}`
        )
        await SecurityEvent.create({
            type: "brute_force",
            ip,
            details: `IP bannie automatiquement : ${reason}`
        })
    } catch (_) {}
}

// ============================================================
// 3. Vérifier si une IP est bannie
// ============================================================
async function checkIPBan(ip) {
    if (!ip || ip === "unknown") return null
    try {
        const IPBan = require("../models/IPBan")
        const ban = await IPBan.findOne({ ip })
        if (!ban) return null
        if (!ban.permanent && ban.bannedUntil && ban.bannedUntil < new Date()) {
            await IPBan.deleteOne({ ip })
            return null
        }
        return ban
    } catch (_) {
        return null
    }
}

// ============================================================
// 4. Réinitialiser le compteur d'une IP après succès
// ============================================================
function clearLoginFailures(req) {
    const ip = getIp(req)
    loginFailures.delete(ip)
}

// ============================================================
// 5. Enregistrer une activité suspecte générique
// ============================================================
async function recordSuspicious(req, type, details, userId = null) {
    const ip = getIp(req)
    const userAgent = req.headers["user-agent"] || null
    try {
        await SecurityEvent.create({ type, ip, userId, userAgent, details })
    } catch (_) {}

    alertAdmins(type, `⚠️ Activité suspecte [${type}] depuis ${ip}`, details)
}

// ============================================================
// 6. Détecteur de flood Socket.io
// ============================================================
function checkSocketFlood(socketId, eventName, limitPerMin = 60) {
    const key = `${socketId}:${eventName}`
    const now = Date.now()
    const entry = socketEvents.get(key) || { count: 0, windowStart: now }

    if (now - entry.windowStart > 60000) {
        entry.count = 1
        entry.windowStart = now
    } else {
        entry.count++
    }
    socketEvents.set(key, entry)

    if (entry.count > limitPerMin) {
        alertAdmins(
            "socket_flood",
            `🚨 Flood Socket.io détecté`,
            `Socket ${socketId} a envoyé ${entry.count} événements "${eventName}" en moins d'1 minute`
        )
        return true
    }
    return false
}

// ============================================================
// 7. Nettoyage périodique des compteurs en mémoire
// ============================================================
setInterval(() => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    for (const [key, entry] of loginFailures) {
        if (entry.lastAttempt < oneHourAgo) loginFailures.delete(key)
    }
    for (const [key, entry] of socketEvents) {
        if (Date.now() - entry.windowStart > 60000) socketEvents.delete(key)
    }
}, 15 * 60 * 1000)

// ============================================================
// 8. Middleware Express : valider les ObjectId MongoDB
// ============================================================
function validateObjectId(paramName = "id") {
    const mongoose = require("mongoose")
    return async (req, res, next) => {
        const val = req.params[paramName]
        if (val && !mongoose.isValidObjectId(val)) {
            await recordSuspicious(
                req,
                "invalid_objectid",
                `ObjectId invalide sur ${req.path}: ${paramName}=${val}`,
                req.session?.user?.id || null
            )
            if (req.xhr || req.headers.accept?.includes("application/json")) {
                return res.status(400).json({ error: "Identifiant invalide." })
            }
            return res.status(400).send("Identifiant invalide.")
        }
        next()
    }
}

module.exports = {
    recordFailedLogin,
    clearLoginFailures,
    recordSuspicious,
    checkSocketFlood,
    checkIPBan,
    autoBanIP,
    validateObjectId,
    alertAdmins,
    getIp
}
