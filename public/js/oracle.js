async function loadOracleQuest() {
    try {
        const res = await fetch("/api/oracle/quest")
        const data = await res.json()
        if (data.success) renderOracleQuest(data.quest, data.streak || 1)
        else hideOracle()
    } catch (e) {
        console.error("Oracle load error:", e)
        hideOracle()
    }
}

function hideOracle() {
    const card = document.getElementById("oracleQuestCard")
    if (card) card.style.display = "none"
}

function getStreakInfo(streak) {
    if (streak >= 30) return { emoji: "🏆", mult: "x3",   color: "#a855f7", msg: "Légendaire — tu es inarrêtable !" }
    if (streak >= 14) return { emoji: "⚡", mult: "x2.5",  color: "#f59e0b", msg: `Encore ${30 - streak} jour(s) pour le palier x3` }
    if (streak >= 7)  return { emoji: "🔥", mult: "x2",    color: "#ef4444", msg: `Encore ${14 - streak} jour(s) pour le palier x2.5` }
    if (streak >= 3)  return { emoji: "💪", mult: "x1.5",  color: "#f97316", msg: `Encore ${7 - streak} jour(s) pour le palier x2` }
    if (streak >= 2)  return { emoji: "🔥", mult: null,    color: "#f59e0b", msg: `Encore ${3 - streak} jour(s) pour un bonus x1.5 sur les coins !` }
    return             { emoji: "🌱", mult: null,    color: "#22c55e", msg: "Reviens demain pour démarrer un streak et gagner des bonus coins !" }
}

function renderOracleQuest(quest, streak) {
    streak = streak || 1
    const loading  = document.getElementById("oracleLoading")
    const content  = document.getElementById("oracleContent")
    const text     = document.getElementById("oracleQuestText")
    const fill     = document.getElementById("oracleProgressFill")
    const label    = document.getElementById("oracleProgressLabel")
    const footer   = document.getElementById("oracleFooter")
    const xpEl     = document.getElementById("oracleXp")
    const coinsEl  = document.getElementById("oracleCoins")

    // Streak row (nouveaux IDs)
    const streakRow   = document.getElementById("oracleStreakRow")
    const streakEmoji = document.getElementById("oracleStreakEmoji")
    const streakCount = document.getElementById("oracleStreakCount")
    const streakUnit  = document.getElementById("oracleStreakUnit")
    const streakMsg   = document.getElementById("oracleStreakMsg")
    const streakMult  = document.getElementById("oracleStreakMult")

    if (!content) return

    const q = quest.quest
    if (xpEl)    xpEl.textContent    = q.reward.xp
    if (coinsEl) coinsEl.textContent = q.reward.coins

    // ── Affichage streak ────────────────────────────────────
    const info = getStreakInfo(streak)

    // Badge dans le header (toujours visible)
    const headerStreak = document.getElementById("oracleHeaderStreak")
    if (headerStreak) {
        headerStreak.style.display = "inline-flex"
        headerStreak.textContent   = info.emoji + " " + streak + (streak > 1 ? " jours" : " jour")
    }

    if (streakRow) {
        streakRow.style.display = "block"
        if (streakEmoji) streakEmoji.textContent = info.emoji
        if (streakCount) streakCount.textContent = streak
        if (streakUnit)  streakUnit.textContent  = streak > 1 ? "jours" : "jour"
        if (streakMsg)   streakMsg.textContent   = info.msg

        // Badge multiplicateur (visible à partir du palier x1.5)
        if (streakMult && info.mult) {
            streakMult.style.display = "inline-block"
            streakMult.textContent   = "Bonus " + info.mult
            streakMult.style.background = `rgba(124,58,237,.12)`
            streakMult.style.color      = info.color
        } else if (streakMult) {
            streakMult.style.display = "none"
        }
    }
    // ────────────────────────────────────────────────────────

    const progress = quest.progress || 0
    const target   = q.targetCount || 1
    const pct      = Math.min(Math.round((progress / target) * 100), 100)

    if (text)  text.textContent  = q.text
    if (fill)  fill.style.width  = pct + "%"
    if (label) label.textContent = progress + " / " + target

    if (footer) {
        if (quest.claimed) {
            const bonusCoins = quest.bonusCoins || 0
            const bonusTxt = bonusCoins > 0
                ? ` · <span style="color:#f59e0b;font-weight:700;">+${bonusCoins} bonus streak ${info.emoji}</span>`
                : ""
            footer.innerHTML = `<div class="oracle-claimed-badge"><i class="fa-solid fa-check-circle"></i> Récompense réclamée — Reviens demain !${bonusTxt}</div>`
        } else if (quest.completed) {
            const bonusTxt = info.mult
                ? `<span style="font-size:11px;opacity:.85;margin-left:6px;">${info.emoji} Bonus ${info.mult} inclus !</span>`
                : ""
            footer.innerHTML = `
                <button class="btn oracle-claim-btn" onclick="claimOracleReward()" id="oracleClaimBtn">
                    <i class="fa-solid fa-gift"></i> Réclamer ma récompense ${bonusTxt}
                </button>`
        } else {
            footer.innerHTML = `
                <button class="btn btn-secondary btn-sm oracle-verify-btn" onclick="verifyOracleQuest()" id="oracleVerifyBtn">
                    <i class="fa-solid fa-rotate"></i> Vérifier ma progression
                </button>`
        }
    }

    if (loading) loading.style.display = "none"
    if (content) content.style.display = "block"

    if (quest.completed && !quest.claimed) {
        const card = document.getElementById("oracleQuestCard")
        if (card) card.classList.add("oracle-completed")
    }
}

async function verifyOracleQuest() {
    const btn = document.getElementById("oracleVerifyBtn")
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Vérification…' }
    try {
        const res  = await fetch("/api/oracle/quest/verify", { method: "POST" })
        const data = await res.json()
        if (data.success) renderOracleQuest(data.quest, data.streak || 1)
    } catch (e) {
        console.error("Oracle verify error:", e)
    } finally {
        if (btn) btn.disabled = false
    }
}

async function claimOracleReward() {
    const btn = document.getElementById("oracleClaimBtn")
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Réclamation…' }
    try {
        const res  = await fetch("/api/oracle/quest/claim", { method: "POST" })
        const data = await res.json()
        if (data.success) {
            const footer = document.getElementById("oracleFooter")
            const card   = document.getElementById("oracleQuestCard")
            const info   = getStreakInfo(data.streak || 1)
            const bonusTxt = data.bonusCoins > 0
                ? ` · <span style="color:#f59e0b;font-weight:700;">+${data.bonusCoins} bonus ${info.emoji}</span>`
                : ""
            if (footer) footer.innerHTML = `<div class="oracle-claimed-badge"><i class="fa-solid fa-check-circle"></i> Récompense réclamée !${bonusTxt}</div>`
            if (card)   { card.classList.remove("oracle-completed"); card.classList.add("oracle-claimed-anim") }
            showOracleToast(data)
        } else if (data.already) {
            const footer = document.getElementById("oracleFooter")
            if (footer) footer.innerHTML = `<div class="oracle-claimed-badge"><i class="fa-solid fa-check-circle"></i> Déjà réclamée — Reviens demain !</div>`
        }
    } catch (e) {
        console.error("Oracle claim error:", e)
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-gift"></i> Réclamer ma récompense' }
    }
}

function showOracleToast(data) {
    const { reward, streak, bonusCoins, totalCoins } = data
    const info    = getStreakInfo(streak || 1)
    const hasBonus = bonusCoins > 0
    const toast   = document.createElement("div")
    toast.className = "oracle-toast"
    toast.innerHTML = `
        <div class="oracle-toast-inner">
            <span style="font-size:28px;line-height:1;">${info.emoji}</span>
            <div>
                <div style="font-weight:700;font-size:14px;">Quête accomplie ! ${streak >= 2 ? "· " + streak + " jours de streak" : ""}</div>
                <div style="font-size:13px;color:var(--text-secondary);">
                    +${reward.xp} XP &nbsp;·&nbsp;
                    ${hasBonus
                        ? `<span style="color:#f59e0b;font-weight:600;">+${totalCoins} coins <small>(dont +${bonusCoins} bonus)</small></span>`
                        : `+${totalCoins} coins`}
                </div>
            </div>
        </div>`
    document.body.appendChild(toast)
    requestAnimationFrame(() => toast.classList.add("oracle-toast-show"))
    setTimeout(() => { toast.classList.remove("oracle-toast-show"); setTimeout(() => toast.remove(), 400) }, 4500)
}

// ── Historique (profil) ──────────────────────────────────────
async function loadOracleHistory() {
    const container = document.getElementById("oracleHistoryList")
    if (!container) return
    try {
        const res  = await fetch("/api/oracle/history")
        const data = await res.json()
        if (!data.success) return
        const dayNames = ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"]
        container.innerHTML = data.history.map(({ day, quest }) => {
            const d     = new Date(day)
            const label = dayNames[d.getDay()] + " " + d.getDate()
            if (!quest) {
                return `<div class="oh-day oh-day-miss" title="${day}">
                    <span class="oh-dot">—</span>
                    <span class="oh-lbl">${label}</span>
                </div>`
            }
            if (quest.claimed) {
                const info = getStreakInfo(quest.streak || 1)
                return `<div class="oh-day oh-day-done" title="${quest.quest.text}">
                    <span class="oh-dot">${info.emoji}</span>
                    <span class="oh-lbl">${label}</span>
                    <span class="oh-coins">+${quest.quest.reward.coins + (quest.bonusCoins || 0)} 🪙</span>
                </div>`
            }
            if (quest.completed) {
                return `<div class="oh-day oh-day-todo" title="${quest.quest.text}">
                    <span class="oh-dot">✅</span>
                    <span class="oh-lbl">${label}</span>
                </div>`
            }
            return `<div class="oh-day oh-day-active" title="${quest.quest.text}">
                <span class="oh-dot">🎯</span>
                <span class="oh-lbl">${label}</span>
            </div>`
        }).join("")
    } catch (e) {
        console.error("Oracle history error:", e)
    }
}

document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("oracleQuestCard"))   loadOracleQuest()
    if (document.getElementById("oracleHistoryList")) loadOracleHistory()
})
