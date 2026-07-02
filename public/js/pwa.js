// Bannière d'installation PWA
let deferredPrompt = null

window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault()
    deferredPrompt = e

    // Afficher le bouton d'installation
    const banner = document.getElementById("pwa-install-banner")
    if (banner) banner.style.display = "flex"
})

window.addEventListener("appinstalled", () => {
    deferredPrompt = null
    const banner = document.getElementById("pwa-install-banner")
    if (banner) banner.style.display = "none"
    console.log("✅ PWA installée !")
})

function installPWA() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    deferredPrompt.userChoice.then((result) => {
        if (result.outcome === "accepted") {
            console.log("✅ Installation acceptée")
        }
        deferredPrompt = null
    })
}
