// =============================================
// PARTAGE DE POST — fonctions globales
// =============================================
let currentSharePostId = null

function openShareModal(postId) {
    currentSharePostId = postId
    const modal = document.getElementById("share-modal-overlay")
    if (!modal) return
    modal.classList.add("active")
    document.body.style.overflow = "hidden"
    const input = document.getElementById("share-message-input")
    if (input) input.value = ""
    const btn = document.getElementById("share-submit-btn")
    if (btn) {
        btn.disabled = false
        btn.innerHTML = '<i class="fa-solid fa-share-nodes"></i> Partager'
    }
}

function closeShareModal() {
    const modal = document.getElementById("share-modal-overlay")
    if (!modal) return
    modal.classList.remove("active")
    document.body.style.overflow = ""
    currentSharePostId = null
}

async function submitShare() {
    if (!currentSharePostId) return

    const message = (document.getElementById("share-message-input")?.value || "").trim()
    const btn = document.getElementById("share-submit-btn")

    if (btn) {
        btn.disabled = true
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Partage...'
    }

    try {
        const res = await fetch(`/post/${currentSharePostId}/share`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message })
        })

        const data = await res.json()

        if (data.success) {
            const countEl = document.querySelector(`.shares-count[data-id="${currentSharePostId}"]`)
            if (countEl) countEl.innerText = data.sharesCount

            const feedEl = document.querySelector(".feed")
            if (feedEl) {
                const newPostEl = buildSharedPostElement(data.post)
                const firstPost = feedEl.querySelector(".post")
                if (firstPost) feedEl.insertBefore(newPostEl, firstPost)
                else feedEl.appendChild(newPostEl)
                if (typeof initInteractions === 'function') initInteractions()
            }

            closeShareModal()
            showShareToast("Publication partagée !")
        } else {
            showShareToast(data.error || "Erreur", true)
            if (btn) {
                btn.disabled = false
                btn.innerHTML = '<i class="fa-solid fa-share-nodes"></i> Partager'
            }
        }
    } catch (e) {
        console.error("Erreur partage:", e)
        showShareToast("Erreur de connexion.", true)
        if (btn) {
            btn.disabled = false
            btn.innerHTML = '<i class="fa-solid fa-share-nodes"></i> Partager'
        }
    }
}

function escapeHtml(text) {
    const div = document.createElement("div")
    div.innerText = text
    return div.innerHTML
}

function buildSharedPostElement(post) {
    const div = document.createElement("div")
    div.className = "card post"
    div.setAttribute("data-id", post._id)

    const date = new Date(post.createdAt).toLocaleString("fr-FR", {
        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
    })
    const sharedDate = new Date(post.sharedFrom.createdAt).toLocaleString("fr-FR", {
        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
    })

    div.innerHTML = `
        <div class="post-header">
            <img src="${escapeHtml(post.auteur.photoProfil)}" class="post-avatar" alt="">
            <div>
                <div class="post-author">${escapeHtml(post.auteur.nom)}</div>
                <div class="post-date">${date}</div>
            </div>
        </div>

        ${post.shareMessage ? `<div class="share-message">${escapeHtml(post.shareMessage)}</div>` : ""}

        <div style="border:1.5px solid var(--border); border-radius:var(--radius-sm); padding:14px; margin-bottom:12px; background:var(--background);">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                <img src="${escapeHtml(post.sharedFrom.auteur.photoProfil)}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;" alt="">
                <div>
                    <div style="font-weight:700;font-size:13px;color:var(--text-primary);">${escapeHtml(post.sharedFrom.auteur.nom)}</div>
                    <div style="font-size:11px;color:var(--text-muted);">${sharedDate}</div>
                </div>
            </div>
            <div style="font-size:13.5px;color:var(--text-secondary);line-height:1.5;white-space:pre-wrap;">${escapeHtml(post.sharedFrom.contenu)}</div>
            ${post.sharedFrom.image ? `<img src="${escapeHtml(post.sharedFrom.image)}" style="width:100%;border-radius:6px;margin-top:8px;max-height:200px;object-fit:cover;" alt="">` : ""}
        </div>

        <div class="post-actions">
            <button class="like-btn" data-id="${post._id}" data-reaction="" title="J'aime">
                <i class="fa-solid fa-heart"></i>
                <span class="likes-count" data-reactions="{}"><span class="reaction-total"></span></span>
            </button>
            <button onclick="toggleComments('${post._id}')" title="Commentaires">
                <i class="fa-solid fa-comment"></i>
                <span class="comments-count">0</span>
            </button>
            <button onclick="openShareModal('${post._id}')" title="Partager">
                <i class="fa-solid fa-share-nodes"></i>
                <span class="shares-count" data-id="${post._id}">0</span>
            </button>
        </div>

        <div class="comments-section" id="comments-${post._id}" style="display:none;">
            <div class="comments-list"></div>
            <form class="comment-form ajax-comment-form" data-id="${post._id}">
                <input type="text" name="texte" placeholder="Écrire un commentaire..." required>
                <button type="submit"><i class="fa-solid fa-paper-plane"></i></button>
            </form>
        </div>
    `
    return div
}

function showShareToast(message, isError = false) {
    const existing = document.getElementById("share-toast")
    if (existing) existing.remove()

    const toast = document.createElement("div")
    toast.id = "share-toast"
    toast.style.cssText = `
        position:fixed; bottom:90px; left:50%; transform:translateX(-50%);
        background:${isError ? "#fee2e2" : "#dcfce7"};
        color:${isError ? "#dc2626" : "#16a34a"};
        border:1px solid ${isError ? "#fca5a5" : "#86efac"};
        padding:10px 20px; border-radius:8px; font-size:13px; font-weight:600;
        z-index:9999; white-space:nowrap; box-shadow:0 4px 12px rgba(0,0,0,0.1);
    `
    toast.innerHTML = `<i class="fa-solid fa-${isError ? "circle-exclamation" : "circle-check"}"></i> ${message}`
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 3000)
}

// Fermer le modal si on clique en dehors
document.addEventListener("click", (e) => {
    if (e.target.id === "share-modal-overlay") closeShareModal()
})

// Exposer globalement
window.openShareModal = openShareModal
window.closeShareModal = closeShareModal
window.submitShare = submitShare
