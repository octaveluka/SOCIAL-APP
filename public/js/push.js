// =============================================
// NOTIFICATIONS PUSH — CLIENT
// =============================================

let pushEnabled = false

// Convertir la clé VAPID en Uint8Array
function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
}

// Vérifier le support et l'état actuel
async function checkPushStatus() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        console.log("📵 Push notifications non supportées")
        updatePushButton(false, true)
        return false
    }

    const permission = Notification.permission
    if (permission === "denied") {
        updatePushButton(false, true)
        return false
    }

    try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()

        if (sub) {
            pushEnabled = true
            updatePushButton(true, false)
            return true
        } else {
            pushEnabled = false
            updatePushButton(false, false)
            return false
        }
    } catch (e) {
        console.error("Erreur checkPushStatus:", e)
        return false
    }
}

// S'abonner aux notifications push
async function subscribePush() {
    try {
        const permission = await Notification.requestPermission()
        if (permission !== "granted") {
            showPushToast("Tu as refusé les notifications. Tu peux les réactiver dans les paramètres du navigateur.", true)
            return false
        }

        // Récupérer la clé publique VAPID
        const res = await fetch("/push/vapid-key")
        const { publicKey } = await res.json()

        const reg = await navigator.serviceWorker.ready
        const subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey)
        })

        // Envoyer la subscription au serveur
        await fetch("/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(subscription)
        })

        pushEnabled = true
        updatePushButton(true, false)
        showPushToast("Notifications activées !")
        return true
    } catch (e) {
        console.error("Erreur subscribePush:", e)
        showPushToast("Erreur lors de l'activation des notifications.", true)
        return false
    }
}

// Se désabonner
async function unsubscribePush() {
    try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()

        if (sub) {
            await fetch("/push/unsubscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ endpoint: sub.endpoint })
            })
            await sub.unsubscribe()
        }

        pushEnabled = false
        updatePushButton(false, false)
        showPushToast("Notifications désactivées.")
    } catch (e) {
        console.error("Erreur unsubscribePush:", e)
    }
}

// Toggle notifications
async function togglePush() {
    if (pushEnabled) {
        await unsubscribePush()
    } else {
        await subscribePush()
    }
}

// Mettre à jour le bouton toggle
function updatePushButton(enabled, disabled) {
    const btn = document.getElementById("push-toggle-btn")
    if (!btn) return

    if (disabled) {
        btn.innerHTML = '<i class="fa-solid fa-bell-slash"></i> Notifications bloquées'
        btn.style.opacity = "0.5"
        btn.style.cursor = "not-allowed"
        btn.onclick = null
        return
    }

    if (enabled) {
        btn.innerHTML = '<i class="fa-solid fa-bell-slash"></i> Désactiver les notifications'
        btn.style.background = "#fee2e2"
        btn.style.color = "#dc2626"
        btn.style.border = "1px solid #fca5a5"
    } else {
        btn.innerHTML = '<i class="fa-solid fa-bell"></i> Activer les notifications'
        btn.style.background = "var(--primary-light)"
        btn.style.color = "var(--primary)"
        btn.style.border = "1px solid #c7d2fe"
    }
    btn.onclick = togglePush
}

// Toast de feedback
function showPushToast(message, isError = false) {
    const existing = document.getElementById("push-toast")
    if (existing) existing.remove()

    const toast = document.createElement("div")
    toast.id = "push-toast"
    toast.style.cssText = `
        position:fixed; bottom:90px; left:50%; transform:translateX(-50%);
        background:${isError ? "#fee2e2" : "#dcfce7"};
        color:${isError ? "#dc2626" : "#16a34a"};
        border:1px solid ${isError ? "#fca5a5" : "#86efac"};
        padding:10px 20px; border-radius:8px; font-size:13px; font-weight:600;
        z-index:9999; white-space:nowrap; box-shadow:var(--shadow-md);
    `
    toast.innerHTML = `<i class="fa-solid fa-${isError ? "circle-exclamation" : "circle-check"}"></i> ${message}`
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 3500)
}

// Initialisation automatique
document.addEventListener("DOMContentLoaded", () => {
    checkPushStatus()
})
