// =============================================
// STORIES — CLIENT
// =============================================

let currentStoryGroups = []
let currentGroupIndex = 0
let currentStoryIndex = 0
let storyTimer = null
let storyProgress = null
const STORY_DURATION = 5000 // 5 secondes par story

// =============================================
// CHARGEMENT ET AFFICHAGE DES BULLES
// =============================================
async function loadStories() {
    try {
        const res = await fetch("/stories")
        const data = await res.json()
        if (!data.success) return

        currentStoryGroups = data.groups
        renderStoryBubbles(data.groups)
    } catch (e) {
        console.error("Erreur loadStories:", e)
    }
}

function renderStoryBubbles(groups) {
    const container = document.getElementById("stories-bubbles")
    if (!container) return

    container.innerHTML = ""

    // Bouton "Ajouter une story"
    const addBtn = document.createElement("div")
    addBtn.className = "story-bubble"
    addBtn.innerHTML = `
        <div class="story-add-btn" onclick="openStoryCreator()">
            <i class="fa-solid fa-plus"></i>
        </div>
        <div class="story-label">Ta story</div>
    `
    container.appendChild(addBtn)

    // Stories des amis
    groups.forEach((group, index) => {
        const bubble = document.createElement("div")
        bubble.className = "story-bubble"
        bubble.onclick = () => openStoryViewer(index)

        const allSeen = !group.hasUnseen

        bubble.innerHTML = `
            <div class="story-ring ${allSeen ? "seen" : ""}">
                <div class="story-ring-inner">
                    <img src="${group.user.photoProfil}" alt="">
                </div>
            </div>
            <div class="story-label">${escapeHtml(group.user.nom.split(" ")[0])}</div>
        `
        container.appendChild(bubble)
    })
}

// =============================================
// VISIONNEUSE
// =============================================
function openStoryViewer(groupIndex, storyIndex = 0) {
    currentGroupIndex = groupIndex
    currentStoryIndex = storyIndex

    const overlay = document.getElementById("story-viewer-overlay")
    overlay.classList.add("active")

    showStory()
    document.body.style.overflow = "hidden"
}

function closeStoryViewer() {
    const overlay = document.getElementById("story-viewer-overlay")
    overlay.classList.remove("active")
    stopStoryTimer()
    document.body.style.overflow = ""
}

function showStory() {
    stopStoryTimer()

    const group = currentStoryGroups[currentGroupIndex]
    if (!group) { closeStoryViewer(); return }

    const story = group.stories[currentStoryIndex]
    if (!story) { closeStoryViewer(); return }

    // Marquer comme vue
    fetch(`/stories/${story._id}/view`, { method: "POST" })

    // Mettre à jour la barre de progression
    renderProgressBars()

    // Header
    document.getElementById("story-author-avatar").src = group.user.photoProfil
    document.getElementById("story-author-name").innerText = group.user.nom
    const timeAgo = getTimeAgo(new Date(story.createdAt))
    document.getElementById("story-time").innerText = timeAgo

    // Média
    const mediaContainer = document.getElementById("story-media-container")
    if (story.couleurFond) {
        mediaContainer.style.background = story.couleurFond
        mediaContainer.innerHTML = ""
    } else if (story.mediaType === "video") {
        mediaContainer.style.background = "#000"
        mediaContainer.innerHTML = `<video src="${story.media}" autoplay playsinline style="width:100%;height:100%;object-fit:contain;" id="story-video-player"></video>`
    } else {
        mediaContainer.style.background = "#000"
        mediaContainer.innerHTML = `<img src="${story.media}" style="width:100%;height:100%;object-fit:contain;" alt="">`
    }

    // Texte overlay
    const textEl = document.getElementById("story-text-overlay")
    textEl.innerText = story.texte || ""
    textEl.style.display = story.texte ? "block" : "none"
    // Centrer verticalement si story texte uniquement (couleurFond = pas de vrai média)
    if (story.couleurFond && story.texte) {
        textEl.classList.add("text-only")
    } else {
        textEl.classList.remove("text-only")
    }

    // Vues
    document.getElementById("story-views-count").innerText = story.vues?.length || 0

    // Démarrer le timer
    startStoryTimer()
}

function renderProgressBars() {
    const group = currentStoryGroups[currentGroupIndex]
    if (!group) return

    const container = document.getElementById("story-progress-container")
    container.innerHTML = ""

    group.stories.forEach((_, i) => {
        const seg = document.createElement("div")
        seg.className = "story-progress-segment"
        seg.id = `progress-seg-${i}`

        const fill = document.createElement("div")
        fill.className = "story-progress-fill"
        fill.id = `progress-fill-${i}`

        if (i < currentStoryIndex) {
            fill.style.width = "100%"
            fill.style.transition = "none"
        } else if (i === currentStoryIndex) {
            fill.style.width = "0%"
        }

        seg.appendChild(fill)
        container.appendChild(seg)
    })
}

function startStoryTimer() {
    const fill = document.getElementById(`progress-fill-${currentStoryIndex}`)
    if (!fill) return

    const video = document.getElementById("story-video-player")
    if (video) {
        // Pour les vidéos : durée réelle, max 60s
        const startTimer = (duration) => {
            const ms = Math.min(duration * 1000, 60000)
            fill.style.transition = `width ${ms}ms linear`
            fill.style.width = "100%"
            storyTimer = setTimeout(() => goToNextStory(), ms)
        }
        if (video.readyState >= 1 && video.duration) {
            startTimer(video.duration)
        } else {
            video.addEventListener("loadedmetadata", () => startTimer(video.duration), { once: true })
        }
    } else {
        fill.style.transition = `width ${STORY_DURATION}ms linear`
        fill.style.width = "100%"
        storyTimer = setTimeout(() => goToNextStory(), STORY_DURATION)
    }
}

function stopStoryTimer() {
    if (storyTimer) {
        clearTimeout(storyTimer)
        storyTimer = null
    }
    const video = document.getElementById("story-video-player")
    if (video) video.pause()
}

function goToNextStory() {
    const group = currentStoryGroups[currentGroupIndex]
    if (!group) { closeStoryViewer(); return }

    if (currentStoryIndex < group.stories.length - 1) {
        currentStoryIndex++
        showStory()
    } else if (currentGroupIndex < currentStoryGroups.length - 1) {
        currentGroupIndex++
        currentStoryIndex = 0
        showStory()
    } else {
        closeStoryViewer()
    }
}

function goToPrevStory() {
    if (currentStoryIndex > 0) {
        currentStoryIndex--
    } else if (currentGroupIndex > 0) {
        currentGroupIndex--
        const prevGroup = currentStoryGroups[currentGroupIndex]
        currentStoryIndex = prevGroup.stories.length - 1
    }
    showStory()
}

// =============================================
// RÉACTIONS
// =============================================
async function reactToStory(emoji) {
    const group = currentStoryGroups[currentGroupIndex]
    if (!group) return
    const story = group.stories[currentStoryIndex]
    if (!story) return

    try {
        await fetch(`/stories/${story._id}/react`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ emoji })
        })

        // Afficher l'animation de réaction
        showReactionAnimation(emoji)
    } catch (e) {
        console.error("Erreur réaction story:", e)
    }
}

function showReactionAnimation(emoji) {
    const overlay = document.getElementById("story-viewer-overlay")
    const el = document.createElement("div")
    el.style.cssText = `
        position:absolute;
        bottom:100px;
        left:50%;
        transform:translateX(-50%);
        font-size:48px;
        animation:storyReactionPop 1s ease forwards;
        z-index:20;
        pointer-events:none;
    `
    el.innerText = emoji
    overlay.appendChild(el)
    setTimeout(() => el.remove(), 1000)
}

// =============================================
// CRÉATEUR DE STORY
// =============================================
const storyColors = [
    "#4f46e5", "#7c3aed", "#db2777", "#dc2626",
    "#d97706", "#16a34a", "#0891b2", "#0f172a",
    "linear-gradient(135deg, #f59e0b, #ef4444)",
    "linear-gradient(135deg, #4f46e5, #7c3aed)"
]

let selectedColor = storyColors[0]
let selectedFile = null

function openStoryCreator() {
    const overlay = document.getElementById("story-creator-overlay")
    overlay.classList.add("active")
    document.body.style.overflow = "hidden"
    renderColorPicker()
}

function closeStoryCreator() {
    const overlay = document.getElementById("story-creator-overlay")
    overlay.classList.remove("active")
    document.body.style.overflow = ""
    selectedFile = null
    document.getElementById("story-file-input").value = ""
    document.getElementById("story-preview-area").style.background = selectedColor
    document.getElementById("story-preview-area").innerHTML = `
        <div style="text-align:center; color:rgba(255,255,255,0.6);">
            <i class="fa-solid fa-image" style="font-size:32px; margin-bottom:8px; display:block;"></i>
            Aperçu
        </div>
    `
    document.getElementById("story-text-input").value = ""
}

function renderColorPicker() {
    const container = document.getElementById("story-color-picker")
    if (!container) return
    container.innerHTML = ""

    storyColors.forEach(color => {
        const swatch = document.createElement("div")
        swatch.className = "story-color-swatch" + (color === selectedColor ? " selected" : "")
        swatch.style.background = color
        swatch.onclick = () => {
            selectedColor = color
            document.querySelectorAll(".story-color-swatch").forEach(s => s.classList.remove("selected"))
            swatch.classList.add("selected")

            if (!selectedFile) {
                document.getElementById("story-preview-area").style.background = color
            }
        }
        container.appendChild(swatch)
    })
}

function handleStoryFileSelect(e) {
    const file = e.target.files[0]
    if (!file) return

    const preview = document.getElementById("story-preview-area")
    const url = URL.createObjectURL(file)

    if (file.type.startsWith("video/")) {
        // Vérifier la durée max 60s
        const tempVideo = document.createElement("video")
        tempVideo.preload = "metadata"
        tempVideo.src = url
        tempVideo.onloadedmetadata = () => {
            if (tempVideo.duration > 60) {
                showStoryToast("La vidéo doit faire moins de 60 secondes.", true)
                document.getElementById("story-file-input").value = ""
                selectedFile = null
                URL.revokeObjectURL(url)
                return
            }
            selectedFile = file
            preview.innerHTML = `<video src="${url}" style="width:100%;height:100%;object-fit:cover;" autoplay muted loop playsinline></video>`
            preview.style.background = "none"
        }
    } else {
        selectedFile = file
        preview.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;" alt="">`
        preview.style.background = "none"
    }
}

async function publishStory() {
    const texte = document.getElementById("story-text-input").value.trim()
    const publishBtn = document.getElementById("story-publish-btn")

    publishBtn.disabled = true
    publishBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Publication...'

    try {
        let res, data

        if (selectedFile) {
            // Story avec média
            const formData = new FormData()
            formData.append("media", selectedFile)
            if (texte) formData.append("texte", texte)
            formData.append("couleurFond", selectedColor)

            res = await fetch("/stories", { method: "POST", body: formData })
        } else if (texte) {
            // Story texte seul
            res = await fetch("/stories/text", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ texte, couleurFond: selectedColor })
            })
        } else {
            showStoryToast("Ajoute une image ou un texte.", true)
            publishBtn.disabled = false
            publishBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Publier'
            return
        }

        data = await res.json()

        if (data.success) {
            closeStoryCreator()
            showStoryToast("Story publiée !")
            await loadStories()
        } else {
            showStoryToast(data.error || "Erreur", true)
        }
    } catch (e) {
        console.error("Erreur publishStory:", e)
        showStoryToast("Erreur de connexion.", true)
    } finally {
        publishBtn.disabled = false
        publishBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Publier'
    }
}

// =============================================
// PANEL VUES
// =============================================
async function showViewersPanel() {
    const group = currentStoryGroups[currentGroupIndex]
    if (!group) return
    const story = group.stories[currentStoryIndex]
    if (!story) return

    stopStoryTimer()

    const panel = document.getElementById("story-viewers-panel")
    const backdrop = document.getElementById("story-viewers-backdrop")
    const list = document.getElementById("story-viewers-list")
    if (!panel || !list) return

    list.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i></div>'
    panel.style.display = "block"
    backdrop.style.display = "block"

    try {
        const res = await fetch(`/stories/${story._id}/viewers`)
        const data = await res.json()

        if (data.restricted) {
            list.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted);">Seul l\'auteur peut voir les vues.</div>'
        } else if (data.success && data.viewers.length > 0) {
            list.innerHTML = data.viewers.map(v => `
                <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
                    <img src="${v.user?.photoProfil || '/images/default.jpg'}" style="width:42px;height:42px;border-radius:50%;object-fit:cover;flex-shrink:0;">
                    <span style="font-weight:600;color:var(--text-primary);font-size:14px;">${escapeHtml(v.user?.nom || 'Utilisateur')}</span>
                </div>
            `).join('')
        } else {
            list.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:13px;">Aucune vue pour le moment.</div>'
        }
    } catch (e) {
        list.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted);">Erreur de chargement.</div>'
    }
}

function closeViewersPanel() {
    const panel = document.getElementById("story-viewers-panel")
    const backdrop = document.getElementById("story-viewers-backdrop")
    if (panel) panel.style.display = "none"
    if (backdrop) backdrop.style.display = "none"
    startStoryTimer()
}

// =============================================
// UTILITAIRES
// =============================================
function getTimeAgo(date) {
    const diff = Date.now() - date.getTime()
    const hours = Math.floor(diff / 3600000)
    const minutes = Math.floor(diff / 60000)
    if (hours >= 1) return `Il y a ${hours}h`
    if (minutes >= 1) return `Il y a ${minutes}min`
    return "À l'instant"
}

function escapeHtml(text) {
    const div = document.createElement("div")
    div.innerText = text
    return div.innerHTML
}

function showStoryToast(message, isError = false) {
    const existing = document.getElementById("story-toast")
    if (existing) existing.remove()

    const toast = document.createElement("div")
    toast.id = "story-toast"
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
    setTimeout(() => toast.remove(), 3000)
}

// Animation réaction
const style = document.createElement("style")
style.textContent = `
    @keyframes storyReactionPop {
        0% { opacity:1; transform:translateX(-50%) scale(1); }
        50% { opacity:1; transform:translateX(-50%) translateY(-30px) scale(1.3); }
        100% { opacity:0; transform:translateX(-50%) translateY(-60px) scale(0.8); }
    }
`
document.head.appendChild(style)

// Initialisation
document.addEventListener("DOMContentLoaded", () => {
    loadStories()
})
