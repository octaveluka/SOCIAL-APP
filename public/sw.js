const CACHE_NAME = "socialapp-v4"
const STATIC_ASSETS = [
    "/",
    "/css/style.css",
    "/js/feed.js",
    "/manifest.json",
    "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css",
    "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
]

// Installation — mise en cache des assets statiques
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log("📦 Service Worker : mise en cache des assets")
            return cache.addAll(STATIC_ASSETS)
        }).then(() => self.skipWaiting())
    )
})

// Activation — nettoyage des anciens caches
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => {
                        console.log(`🗑️ Service Worker : suppression cache ${name}`)
                        return caches.delete(name)
                    })
            )
        }).then(() => self.clients.claim())
    )
})

// Fetch — stratégie Network First pour les pages, Cache First pour les assets
self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url)

    // Ne pas intercepter les requêtes Socket.io
    if (url.pathname.startsWith("/socket.io")) return

    // Ne pas intercepter les requêtes POST/PUT/DELETE
    if (event.request.method !== "GET") return

    // Assets statiques — Cache First
    if (
        url.pathname.startsWith("/css/") ||
        url.pathname.startsWith("/js/") ||
        url.pathname.startsWith("/icons/") ||
        url.pathname.startsWith("/uploads/") ||
        url.hostname.includes("cloudinary.com") ||
        url.hostname.includes("fonts.googleapis.com") ||
        url.hostname.includes("cdnjs.cloudflare.com")
    ) {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                return cached || fetch(event.request).then((response) => {
                    const clone = response.clone()
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
                    return response
                })
            })
        )
        return
    }

    // Pages HTML — Network First (toujours frais), fallback cache
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                const clone = response.clone()
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
                return response
            })
            .catch(() => {
                return caches.match(event.request).then((cached) => {
                    if (cached) return cached
                    // Page offline de fallback
                    return caches.match("/offline.html")
                })
            })
    )
})

// Notifications push
self.addEventListener("push", (event) => {
    if (!event.data) return

    let data = {}
    try { data = event.data.json() } catch (e) { data = { title: "SocialApp", body: event.data.text() } }

    const options = {
        body: data.body || "Tu as une nouvelle notification",
        icon: data.icon || "/icons/icon-192.png",
        badge: "/icons/icon-72.png",
        vibrate: [200, 100, 200, 100, 200],
        sound: "/sounds/Sale-notification-chime-sound-effect.mp3",
        data: { url: data.url || "/" },
        tag: data.tag || "socialapp-notif",
        renotify: true,
        requireInteraction: false,
        silent: false,
        actions: [
            { action: "open", title: "Voir" },
            { action: "close", title: "Ignorer" }
        ]
    }

    event.waitUntil(
        self.registration.showNotification(data.title || "SocialApp", options)
    )
})

// Clic sur notification push
self.addEventListener("notificationclick", (event) => {
    event.notification.close()

    if (event.action === "close") return

    const url = event.notification.data?.url || "/"

    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
            // Si l'app est déjà ouverte, focus et navigate
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && "focus" in client) {
                    client.focus()
                    return client.navigate(url)
                }
            }
            // Sinon ouvrir un nouvel onglet
            if (clients.openWindow) {
                return clients.openWindow(url)
            }
        })
    )
})
