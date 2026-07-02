const webpush = require("web-push")
const PushSubscription = require("../models/PushSubscription")

// Configuration VAPID — optionnelle (pas de crash si clés absentes)
let vapidEnabled = false
try {
    if (process.env.VAPID_EMAIL && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
        webpush.setVapidDetails(
            process.env.VAPID_EMAIL,
            process.env.VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY
        )
        vapidEnabled = true
    } else {
        console.log("ℹ️ Push notifications désactivées (clés VAPID manquantes)")
    }
} catch (e) {
    console.warn("⚠️ Erreur configuration web-push:", e.message)
}

// Envoyer une notification push à un utilisateur
async function sendPushToUser(userId, payload) {
    if (!vapidEnabled) return
    try {
        const subscriptions = await PushSubscription.find({
            user: userId,
            active: true
        })

        if (subscriptions.length === 0) return

        const results = await Promise.allSettled(
            subscriptions.map(async (sub) => {
                try {
                    await webpush.sendNotification(
                        {
                            endpoint: sub.endpoint,
                            keys: {
                                p256dh: sub.keys.p256dh,
                                auth: sub.keys.auth
                            }
                        },
                        JSON.stringify(payload)
                    )
                } catch (err) {
                    // Subscription expirée ou invalide → désactiver
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        await PushSubscription.findByIdAndUpdate(sub._id, { active: false })
                        console.log(`📵 Subscription expirée supprimée pour user ${userId}`)
                    }
                    throw err
                }
            })
        )

        const sent = results.filter(r => r.status === "fulfilled").length
        console.log(`📨 Push envoyé à ${sent}/${subscriptions.length} appareils pour user ${userId}`)
    } catch (e) {
        console.error("Erreur sendPushToUser:", e.message)
    }
}

// Envoyer une notification push à plusieurs utilisateurs
async function sendPushToUsers(userIds, payload) {
    await Promise.allSettled(userIds.map(id => sendPushToUser(id, payload)))
}

// Construire le payload selon le type de notification
function buildPayload(type, data) {
    const base = {
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-72.png",
        vibrate: [200, 100, 200],
        timestamp: Date.now()
    }

    switch (type) {
        case "message":
            return {
                ...base,
                title: `💬 ${data.senderName}`,
                body: data.content || "T'a envoyé un message",
                url: `/messages/${data.senderId}`,
                tag: `message-${data.senderId}`
            }

        case "group-message":
            return {
                ...base,
                title: `👥 ${data.groupName}`,
                body: `${data.senderName} : ${data.content || "Message vocal"}`,
                url: `/groups/${data.groupId}`,
                tag: `group-${data.groupId}`
            }

        case "mention":
            return {
                ...base,
                title: `📢 ${data.senderName} t'a mentionné`,
                body: data.content || "Dans un groupe",
                url: data.url || "/notifications",
                tag: `mention-${data.senderId}`
            }

        case "friend-request":
            return {
                ...base,
                title: `👤 Demande d'ami`,
                body: `${data.senderName} veut être ton ami`,
                url: "/friends",
                tag: `friend-${data.senderId}`
            }

        case "friend-accepted":
            return {
                ...base,
                title: `✅ Demande acceptée`,
                body: `${data.senderName} a accepté ta demande d'ami`,
                url: `/profile/${data.senderId}`,
                tag: `friend-accepted-${data.senderId}`
            }

        case "like":
            return {
                ...base,
                title: `❤️ ${data.senderName} a aimé ta publication`,
                body: data.content ? `"${data.content.slice(0, 60)}..."` : "",
                url: "/",
                tag: `like-${data.senderId}`
            }

        case "comment":
            return {
                ...base,
                title: `💬 ${data.senderName} a commenté`,
                body: data.content || "Ta publication",
                url: "/",
                tag: `comment-${data.senderId}`
            }

        case "coins":
            return {
                ...base,
                title: `🪙 Tu as reçu des coins !`,
                body: `+${data.amount} coins${data.reason ? ` — ${data.reason}` : ""}`,
                url: "/wallet",
                tag: "coins"
            }

        case "warning":
            return {
                ...base,
                title: `⚠️ Avertissement reçu`,
                body: data.motif || "Tu as reçu un avertissement de modération",
                url: "/",
                tag: "warning"
            }

        case "restriction":
            return {
                ...base,
                title: `🔒 Restriction appliquée`,
                body: data.message || "Une restriction a été appliquée sur ton compte",
                url: "/",
                tag: "restriction"
            }

        default:
            return {
                ...base,
                title: "SocialApp",
                body: data.message || "Tu as une nouvelle notification",
                url: data.url || "/notifications",
                tag: "general"
            }
    }
}

module.exports = { sendPushToUser, sendPushToUsers, buildPayload }
