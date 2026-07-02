// =====================================================
// 1. MODE SOMBRE
// =====================================================
document.addEventListener('DOMContentLoaded', function() {
    const themeToggle = document.getElementById('themeToggle');

    if (themeToggle) {
        const currentTheme = localStorage.getItem('theme');

        if (currentTheme === 'dark') {
            document.body.classList.add('dark-mode');
            const icon = themeToggle.querySelector('i');
            if (icon) icon.className = 'fa-solid fa-sun';
        }

        themeToggle.addEventListener('click', function(e) {
            e.preventDefault();
            document.body.classList.toggle('dark-mode');
            
            const icon = this.querySelector('i');
            if (document.body.classList.contains('dark-mode')) {
                localStorage.setItem('theme', 'dark');
                if (icon) icon.className = 'fa-solid fa-sun';
            } else {
                localStorage.setItem('theme', 'light');
                if (icon) icon.className = 'fa-solid fa-moon';
            }
        });

        if (!localStorage.getItem('theme')) {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (prefersDark) {
                document.body.classList.add('dark-mode');
                const icon = themeToggle.querySelector('i');
                if (icon) icon.className = 'fa-solid fa-sun';
                localStorage.setItem('theme', 'dark');
            }
        }
    }

    // Enregistrer la page initiale dans l'historique pour que le bouton retour fonctionne
    if (!history.state?.url) {
        history.replaceState({ url: window.location.href, scroll: 0 }, '', window.location.href);
    }

    initNotifications();
    setTimeout(function() { initProfileEffects(); }, 100);
    updateNotificationBadge();

    initSocketNotifications();

    // Délégation d'événements — une seule fois, survit aux navigations AJAX
    initDelegation();
});

// =====================================================
// 2. GESTION DES NOTIFICATIONS
// =====================================================
let notificationEnabled = true;
let soundEnabled = true;

function initNotifications() {
    const savedNotif = localStorage.getItem('notificationEnabled');
    if (savedNotif !== null) notificationEnabled = savedNotif === 'true';
    const savedSound = localStorage.getItem('soundEnabled');
    if (savedSound !== null) soundEnabled = savedSound === 'true';

    requestNotificationPermission();
    updateNotificationIcon();

    const toggleBtn = document.getElementById('toggleNotificationsBtn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', function(e) {
            e.preventDefault();
            notificationEnabled = !notificationEnabled;
            localStorage.setItem('notificationEnabled', notificationEnabled);
            updateNotificationIcon();
            if (notificationEnabled && Notification.permission === 'default') {
                Notification.requestPermission();
            }
        });
    }
}

function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('⚠️ Ce navigateur ne supporte pas les notifications');
        return;
    }
    if (Notification.permission === 'granted') {
        console.log('✅ Notifications déjà autorisées');
        return;
    }
    if (Notification.permission === 'denied') {
        console.log('⚠️ Notifications bloquées');
        notificationEnabled = false;
        localStorage.setItem('notificationEnabled', 'false');
        updateNotificationIcon();
        return;
    }
    if (notificationEnabled) {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                console.log('✅ Permission accordée');
            } else {
                notificationEnabled = false;
                localStorage.setItem('notificationEnabled', 'false');
                updateNotificationIcon();
            }
        });
    }
}

function updateNotificationIcon() {
    const toggleBtn = document.getElementById('toggleNotificationsBtn');
    if (!toggleBtn) return;
    const icon = toggleBtn.querySelector('i');
    if (!icon) return;
    if (notificationEnabled && Notification.permission === 'granted') {
        icon.className = 'fa-solid fa-bell';
        icon.style.color = '#3b82f6';
    } else {
        icon.className = 'fa-regular fa-bell';
        icon.style.color = 'var(--text-secondary)';
    }
}

// =====================================================
// 3. NOTIFICATION PUSH
// =====================================================
function sendPushNotification(title, body, icon = '/images/logo.png') {
    if (!notificationEnabled) return;
    if (Notification.permission !== 'granted') return;
    try {
        new Notification(title, { body, icon });
    } catch (e) {
        console.log('⚠️ Erreur push:', e);
    }
}

// =====================================================
// 4. SON
// =====================================================
function playNotificationSound() {
    if (!soundEnabled) return;
    try {
        const audio = new Audio('/sounds/Sale-notification-chime-sound-effect.mp3');
        audio.volume = 0.6;
        audio.play().catch(e => console.log('⚠️ Son bloqué:', e.message));
    } catch (e) {
        console.log('⚠️ Erreur son:', e.message);
    }
}

// =====================================================
// 5. TOAST
// =====================================================
function showNotificationToast(notif) {
    if (!notif) return;
    const toast = document.createElement('div');
    toast.className = 'notification-toast';
    const expediteurNom = notif.expediteur?.nom || 'Quelqu\'un';
    let text = '';
    switch (notif.type) {
        case 'like': text = `${expediteurNom} a aimé votre publication.`; break;
        case 'commentaire': text = `${expediteurNom} a commenté votre publication.`; break;
        case 'reponse': text = `${expediteurNom} a répondu à votre commentaire.`; break;
        case 'mention': text = `${expediteurNom} vous a mentionné dans un commentaire.`; break;
        case 'demande_ami': text = `${expediteurNom} vous a envoyé une demande d'ami.`; break;
        case 'ami_accepte': text = `${expediteurNom} a accepté votre demande d'ami.`; break;
        case 'message': text = `Nouveau message de ${expediteurNom}`; break;
        default: text = 'Nouvelle notification';
    }
    toast.innerHTML = `<i class="fas fa-bell"></i> ${text}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}

// =====================================================
// 6. BADGE
// =====================================================
async function updateNotificationBadge() {
    try {
        const res = await fetch('/notifications/unread');
        const data = await res.json();
        
        const badge = document.getElementById('notifBadge');
        if (badge) {
            if (data.count > 0) {
                badge.textContent = data.count;
                badge.style.display = 'inline-block';
            } else {
                badge.textContent = '';
                badge.style.display = 'none';
            }
        }
        const badgeMobile = document.getElementById('notifBadgeMobile');
        if (badgeMobile) {
            if (data.count > 0) {
                badgeMobile.textContent = data.count;
                badgeMobile.style.display = 'inline-block';
            } else {
                badgeMobile.textContent = '';
                badgeMobile.style.display = 'none';
            }
        }
    } catch (err) {
        console.log('⚠️ Erreur mise à jour badge:', err);
    }
}

// =====================================================
// 7. NOTIFICATION UNIFIÉE
// =====================================================
function notifyUser(notif) {
    console.log('🔔 notifyUser() appelé avec :', notif);

    playNotificationSound();

    const message = getNotificationMessage(notif);

    sendPushNotification(
        'Nouvelle notification',
        message
    );

    updateNotificationBadge();
    showNotificationToast(notif);
}

function getNotificationMessage(notif) {
    const expediteurNom = notif.expediteur?.nom || 'Quelqu\'un';
    switch (notif.type) {
        case 'like': return `${expediteurNom} a aimé votre publication.`;
        case 'commentaire': return `${expediteurNom} a commenté votre publication.`;
        case 'reponse': return `${expediteurNom} a répondu à votre commentaire.`;
        case 'mention': return `${expediteurNom} vous a mentionné dans un commentaire.`;
        case 'demande_ami': return `${expediteurNom} vous a envoyé une demande d'ami.`;
        case 'ami_accepte': return `${expediteurNom} a accepté votre demande d'ami.`;
        case 'message': return `Nouveau message de ${expediteurNom}`;
        default: return 'Nouvelle notification';
    }
}

// =====================================================
// 8. EXPOSITION GLOBALE
// =====================================================
window.notifyUser = notifyUser;
window.playNotificationSound = playNotificationSound;
window.sendPushNotification = sendPushNotification;
window.updateNotificationBadge = updateNotificationBadge;
window.notificationEnabled = notificationEnabled;

// =====================================================
// 9. SOCKET.IO NOTIFICATIONS
// =====================================================
function initSocketNotifications() {
    if (window.notificationSocket) {
        console.log('ℹ️ Socket déjà initialisé');
        return;
    }

    let currentUserId = null;
    
    const userElement = document.querySelector('[data-user-id]');
    if (userElement) {
        currentUserId = userElement.dataset.userId;
        console.log('✅ currentUserId trouvé via data-user-id:', currentUserId);
    }
    
    if (!currentUserId) {
        const scriptTags = document.querySelectorAll('script');
        for (const script of scriptTags) {
            const match = script.textContent.match(/const\s+currentUserId\s*=\s*["']([^"']+)["']/);
            if (match) {
                currentUserId = match[1];
                console.log('✅ currentUserId trouvé via script:', currentUserId);
                break;
            }
        }
    }
    
    if (!currentUserId) {
        const bodyUserId = document.body.getAttribute('data-user-id');
        if (bodyUserId) {
            currentUserId = bodyUserId;
            console.log('✅ currentUserId trouvé via body:', currentUserId);
        }
    }

    if (!currentUserId) {
        console.error('❌ Impossible de récupérer currentUserId !');
        return;
    }

    if (typeof io === 'undefined') {
        console.error('❌ Socket.IO non chargé !');
        return;
    }

    window.notificationSocket = io({
        query: { userId: currentUserId }
    });

    const socket = window.notificationSocket;
    
    socket.on('connect', function() {
        console.log('✅ Socket.IO connecté avec userId:', currentUserId);
    });

    socket.on('connect_error', function(err) {
        console.error('❌ Erreur de connexion Socket.IO:', err);
    });

    socket.on('notification', function(notif) {
        console.log('🔔 Événement notification reçu brut :', notif);
        console.log('🔔 Destinataire reçu:', notif.destinataire, '| CurrentUserId:', currentUserId);
        
        if (String(notif.destinataire) !== String(currentUserId)) {
            console.log('🔔 Notification ignorée (pas pour moi)');
            return;
        }
        
        console.log('🔔 Notification acceptée, appel de notifyUser()');
        notifyUser(notif);
    });
    
    console.log('✅ Écoute des notifications Socket.IO activée (socket unique)');
}

// =====================================================
// 10. INTERACTIONS — EVENT DELEGATION (survit au AJAX)
// =====================================================

// ===== TOOLTIP RÉSUMÉ RÉACTIONS =====
const _tooltip = document.createElement('div');
_tooltip.id = 'reaction-summary-tooltip';
document.body.appendChild(_tooltip);

function _showReactionSummary(countSpan) {
    let counts = {};
    try { counts = JSON.parse(countSpan.dataset.reactions || '{}'); } catch(e) {}
    const order = ['heart','haha','wow','sad','clap','grr'];
    const labels = { heart:'❤️', haha:'😂', wow:'😮', sad:'😢', clap:'👏', grr:'😠' };
    const items = order.filter(t => counts[t] > 0);
    if (items.length === 0) return;
    _tooltip.innerHTML = items.map(t =>
        `<div class="tip-item">${labels[t]} <span class="tip-count">${counts[t]}</span></div>`
    ).join('');
    const rect = countSpan.getBoundingClientRect();
    _tooltip.style.left = (rect.left + rect.width / 2) + 'px';
    _tooltip.style.top = (rect.top - 48) + 'px';
    _tooltip.style.transform = 'translateX(-50%)';
    _tooltip.classList.add('visible');
}

function _hideReactionSummary() {
    _tooltip.classList.remove('visible');
}

document.addEventListener('mouseover', function(e) {
    const span = e.target.closest('.likes-count[data-reactions]');
    if (span) _showReactionSummary(span);
});
document.addEventListener('mouseout', function(e) {
    if (e.target.closest('.likes-count[data-reactions]')) _hideReactionSummary();
});

// ===== REACTIONS — picker global attaché au body =====
const REACTION_EMOJIS = { heart: '❤️', haha: '😂', wow: '😮', sad: '😢', clap: '👏', grr: '😠' };

function _buildLikesHTML(total, counts) {
    const n = total > 0 ? total : 0;
    const countPart = `<span class="reaction-total">${n || ''}</span>`;
    if (n <= 1) return countPart;
    const bubbles = Object.entries(counts || {})
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([type]) => REACTION_EMOJIS[type] || '')
        .join('');
    return bubbles ? `<span class="reaction-bubbles">${bubbles}</span>${countPart}` : countPart;
}

const _picker = document.createElement('div');
_picker.id = 'reaction-picker-global';
_picker.innerHTML = `
    <button class="reaction-opt" data-type="heart" title="J'aime">❤️</button>
    <button class="reaction-opt" data-type="haha"  title="Haha">😂</button>
    <button class="reaction-opt" data-type="wow"   title="Waouh">😮</button>
    <button class="reaction-opt" data-type="sad"   title="Triste">😢</button>
    <button class="reaction-opt" data-type="clap"  title="Bravo">👏</button>
    <button class="reaction-opt" data-type="grr"   title="Grrr">😠</button>
`;
document.body.appendChild(_picker);

let _pressTimer = null;
let _isLongPress = false;
let _currentPickerPostId = null;
let _commentPressTimer = null;
let _isCommentLongPress = false;

function _showPicker(postId, anchorBtn) {
    _currentPickerPostId = postId;
    // Marque la réaction active de l'utilisateur
    const userReaction = anchorBtn.dataset.reaction || '';
    _picker.querySelectorAll('.reaction-opt').forEach(o => {
        o.dataset.post = postId;
        o.classList.toggle('active-reaction', o.dataset.type === userReaction);
    });
    // Positionner d'abord (sans la classe visible) pour mesurer correctement
    _picker.classList.remove('visible');
    const rect = anchorBtn.getBoundingClientRect();
    const pickerW = _picker.offsetWidth || 300;
    const pickerH = _picker.offsetHeight || 52;
    let left = rect.left + rect.width / 2 - pickerW / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - pickerW - 8));
    const topAbove = rect.top - pickerH - 10;
    _picker.style.left = left + 'px';
    _picker.style.top = (topAbove < 8 ? rect.bottom + 10 : topAbove) + 'px';
    // Forcer le reflow puis animer
    void _picker.offsetWidth;
    _picker.classList.add('visible');
}

function _hidePicker() {
    _picker.classList.remove('visible');
    _currentPickerPostId = null;
    // Reset comment data on picker buttons
    _picker.querySelectorAll('.reaction-opt').forEach(o => delete o.dataset.comment);
}

function _showCommentPicker(postId, commentId, anchorBtn) {
    const userReaction = anchorBtn.dataset.reaction || '';
    _picker.querySelectorAll('.reaction-opt').forEach(o => {
        o.dataset.post = postId;
        o.dataset.comment = commentId;
        o.classList.toggle('active-reaction', o.dataset.type === userReaction);
    });
    _picker.classList.remove('visible');
    const rect = anchorBtn.getBoundingClientRect();
    const pickerW = _picker.offsetWidth || 300;
    const pickerH = _picker.offsetHeight || 52;
    let left = rect.left + rect.width / 2 - pickerW / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - pickerW - 8));
    const topAbove = rect.top - pickerH - 10;
    _picker.style.left = left + 'px';
    _picker.style.top = (topAbove < 8 ? rect.bottom + 10 : topAbove) + 'px';
    void _picker.offsetWidth;
    _picker.classList.add('visible');
}

function _updateLikeBtn(btn, reactionType) {
    const iconSlot = btn.querySelector('i, .reaction-emoji-display');
    if (reactionType) {
        btn.classList.add('liked');
        btn.dataset.reaction = reactionType;
        if (iconSlot) {
            iconSlot.outerHTML = `<span class="reaction-emoji-display">${REACTION_EMOJIS[reactionType]}</span>`;
        }
    } else {
        btn.classList.remove('liked');
        btn.dataset.reaction = '';
        const slot = btn.querySelector('i, .reaction-emoji-display');
        if (slot) slot.outerHTML = `<i class="fa-solid fa-heart"></i>`;
    }
}

async function handleReaction(type, postId) {
    if (!type || !postId) return;
    _hidePicker();

    const likeBtn = document.querySelector(`.like-btn[data-id="${postId}"]`);
    const prevReaction = likeBtn ? likeBtn.dataset.reaction : '';
    const newReaction = prevReaction === type ? null : type;

    if (likeBtn) _updateLikeBtn(likeBtn, newReaction);

    try {
        const res = await fetch(`/post/${postId}/react`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type })
        });
        const data = await res.json();
        if (data.success) {
            if (likeBtn) {
                const countSpan = likeBtn.querySelector('.likes-count');
                if (countSpan) {
                    let counts = {};
                    try { counts = JSON.parse(countSpan.dataset.reactions || '{}'); } catch(e) {}
                    if (prevReaction && prevReaction !== type) counts[prevReaction] = Math.max(0, (counts[prevReaction] || 1) - 1);
                    if (data.userReaction) counts[data.userReaction] = (counts[data.userReaction] || 0) + 1;
                    else if (prevReaction === type) counts[type] = Math.max(0, (counts[type] || 1) - 1);
                    Object.keys(counts).forEach(k => { if (counts[k] <= 0) delete counts[k]; });
                    countSpan.dataset.reactions = JSON.stringify(counts);
                    countSpan.innerHTML = _buildLikesHTML(data.reactionsCount, counts);
                }
            }
        } else {
            if (likeBtn) _updateLikeBtn(likeBtn, prevReaction || null);
        }
    } catch (err) {
        if (likeBtn) _updateLikeBtn(likeBtn, prevReaction || null);
        console.error('❌ Erreur réaction:', err);
    }
}

async function handleCommentReact(type, postId, commentId) {
    if (!type || !postId || !commentId) return;
    _hidePicker();

    const btn = document.querySelector(`.comment-like-btn[data-post="${postId}"][data-comment="${commentId}"]`);
    const prevReaction = btn ? btn.dataset.reaction : '';
    const newReaction = prevReaction === type ? null : type;
    const CEMOJI = {heart:'❤️',haha:'😂',wow:'😮',sad:'😢',clap:'👏',grr:'😠'};

    if (btn) {
        btn.classList.toggle('liked', !!newReaction);
        btn.dataset.reaction = newReaction || '';
        const iconSlot = btn.querySelector('i, .c-reaction-emoji');
        if (newReaction) {
            if (iconSlot) iconSlot.outerHTML = `<span class="c-reaction-emoji">${CEMOJI[newReaction]}</span>`;
            else btn.insertAdjacentHTML('afterbegin', `<span class="c-reaction-emoji">${CEMOJI[newReaction]}</span>`);
        } else {
            if (iconSlot) iconSlot.outerHTML = `<i class="fa-regular fa-heart"></i>`;
        }
    }

    try {
        const res = await fetch(`/post/${postId}/comment/${commentId}/react`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type })
        });
        const data = await res.json();
        if (data.success && btn) {
            let countSpan = btn.querySelector('.comment-likes-count');
            if (data.likesCount > 0) {
                if (!countSpan) {
                    countSpan = document.createElement('span');
                    countSpan.className = 'comment-likes-count';
                    btn.appendChild(countSpan);
                }
                countSpan.textContent = data.likesCount;
            } else if (countSpan) {
                countSpan.remove();
            }
        } else if (!data.success && btn) {
            btn.dataset.reaction = prevReaction;
        }
    } catch (err) {
        if (btn) btn.dataset.reaction = prevReaction;
        console.error('❌ Erreur réaction commentaire:', err);
    }
}

// Appelée une seule fois au chargement initial — les délégations
// sur document fonctionnent même après remplacement AJAX du DOM.
function initDelegation() {
    // --- LONG PRESS — Pointer Events API (unifié souris + tactile + stylet) ---
    document.addEventListener('pointerdown', function(e) {
        const likeBtn = e.target.closest('.like-btn');
        if (likeBtn) {
            _isLongPress = false;
            clearTimeout(_pressTimer);
            _pressTimer = setTimeout(() => {
                _isLongPress = true;
                _showPicker(likeBtn.dataset.id, likeBtn);
            }, 500);
            return;
        }
        const cLikeBtn = e.target.closest('.comment-like-btn');
        if (cLikeBtn) {
            _isCommentLongPress = false;
            clearTimeout(_commentPressTimer);
            _commentPressTimer = setTimeout(() => {
                _isCommentLongPress = true;
                _showCommentPicker(cLikeBtn.dataset.post, cLikeBtn.dataset.comment, cLikeBtn);
            }, 500);
        }
    });

    document.addEventListener('pointerup', () => { clearTimeout(_pressTimer); clearTimeout(_commentPressTimer); });
    document.addEventListener('pointercancel', () => {
        clearTimeout(_pressTimer); _isLongPress = false;
        clearTimeout(_commentPressTimer); _isCommentLongPress = false;
    });

    // Bloquer le menu contextuel natif sur les boutons like (iOS Safari / clic droit desktop)
    document.addEventListener('contextmenu', function(e) {
        if (e.target.closest('.like-btn, .comment-like-btn')) e.preventDefault();
    });

    // --- CLICKS ---
    document.addEventListener('click', function(e) {
        // Emoji du picker global (post ou commentaire)
        const reactionOpt = e.target.closest('#reaction-picker-global .reaction-opt');
        if (reactionOpt) {
            e.stopPropagation();
            const commentId = reactionOpt.dataset.comment;
            if (commentId) handleCommentReact(reactionOpt.dataset.type, reactionOpt.dataset.post, commentId);
            else handleReaction(reactionOpt.dataset.type, reactionOpt.dataset.post);
            return;
        }

        // Clic court sur le bouton like post → bascule ❤️
        const likeBtn = e.target.closest('.like-btn');
        if (likeBtn) {
            e.stopPropagation();
            if (_isLongPress) { _isLongPress = false; return; }
            handleReaction('heart', likeBtn.dataset.id);
            return;
        }

        // Clic court sur le bouton like commentaire → bascule ❤️
        const cLikeBtn = e.target.closest('.comment-like-btn');
        if (cLikeBtn) {
            e.stopPropagation();
            if (_isCommentLongPress) { _isCommentLongPress = false; return; }
            handleCommentReact('heart', cLikeBtn.dataset.post, cLikeBtn.dataset.comment);
            return;
        }

        // Bouton Répondre
        const replyBtn = e.target.closest('.comment-reply-btn');
        if (replyBtn) {
            e.stopPropagation();
            _setReplyMode(replyBtn.dataset.post, replyBtn.dataset.commentAuthorId, replyBtn.dataset.commentAuthor, replyBtn.dataset.commentId);
            return;
        }

        // Annuler la réponse
        const cancelReply = e.target.closest('.cancel-reply');
        if (cancelReply) {
            e.stopPropagation();
            const form = cancelReply.closest('.comment-form-wrap')?.querySelector('.ajax-comment-form');
            _clearReplyMode(form);
            return;
        }

        // Afficher / masquer les réponses imbriquées
        const showRepliesBtn = e.target.closest('.show-replies-btn');
        if (showRepliesBtn) {
            e.stopPropagation();
            const cId = showRepliesBtn.dataset.comment;
            const wrap = document.getElementById(`replies-${cId}`);
            if (wrap) {
                const isOpen = wrap.style.display !== 'none';
                wrap.style.display = isOpen ? 'none' : 'block';
                const count = wrap.querySelectorAll('.comment').length;
                showRepliesBtn.innerHTML = isOpen
                    ? `<i class="fa-solid fa-comment-dots"></i> ${count} réponse${count !== 1 ? 's' : ''}`
                    : `<i class="fa-solid fa-chevron-up"></i> Masquer`;
            }
            return;
        }

        // Suggestion @mention
        const mentionItem = e.target.closest('.mention-item');
        if (mentionItem) {
            e.stopPropagation();
            _insertMention(mentionItem);
            return;
        }

        // Fermer le picker si clic en dehors
        if (_currentPickerPostId && !e.target.closest('#reaction-picker-global')) {
            _hidePicker();
        }

        const deleteBtn = e.target.closest('.delete-post, [data-delete-post]');
        if (deleteBtn) { handleDelete(deleteBtn); return; }

        const shareBtn = e.target.closest('.share-btn, [data-share-btn]');
        if (shareBtn) { handleShare(shareBtn); return; }

        const toggleBtn = e.target.closest('.toggle-comments, [data-toggle-comments]');
        if (toggleBtn) { toggleComments(toggleBtn); return; }
    });

    // @mention detection on comment inputs
    document.addEventListener('input', function(e) {
        const input = e.target.closest('.ajax-comment-form input[name="texte"]');
        if (input) _handleMentionInput(input);
    });

    // --- SOUMISSIONS DE FORMULAIRES ---
    document.addEventListener('submit', function(e) {
        const commentForm = e.target.closest('.comment-form, [data-comment-form]');
        if (commentForm) { e.preventDefault(); handleComment(commentForm); return; }
    });
}

// Garde la compatibilité : initInteractions() ne fait plus rien (délégation active)
function initInteractions() {}

// =====================================================
// REPLY MODE & @MENTION HELPERS
// =====================================================
function _setReplyMode(postId, authorId, authorName) {
    const section = document.getElementById(`comments-${postId}`);
    if (!section) return;
    const wrap = section.querySelector('.comment-form-wrap');
    const form = wrap?.querySelector('.ajax-comment-form');
    const indicator = wrap?.querySelector('.reply-indicator');
    const input = form?.querySelector('input[name="texte"]');
    if (!form || !indicator || !input) return;
    form.dataset.replyToUserId = authorId || '';
    form.dataset.replyToNom = authorName || '';
    indicator.querySelector('.reply-to-name').textContent = authorName || '';
    indicator.style.display = 'flex';
    input.placeholder = `Répondre à @${authorName}…`;
    input.focus();
}

function _clearReplyMode(form) {
    if (!form) return;
    const wrap = form.closest('.comment-form-wrap');
    const indicator = wrap?.querySelector('.reply-indicator');
    const input = form.querySelector('input[name="texte"]');
    delete form.dataset.replyToUserId;
    delete form.dataset.replyToNom;
    if (indicator) indicator.style.display = 'none';
    if (input) input.placeholder = 'Écrire un commentaire…';
}

function _handleMentionInput(input) {
    const val = input.value;
    const cursor = input.selectionStart || val.length;
    const textBefore = val.slice(0, cursor);
    const match = textBefore.match(/@(\w*)$/);
    const wrap = input.closest('.comment-form-wrap');
    const dropdown = wrap?.querySelector('.mention-dropdown');
    if (!match || match[1].length < 1) {
        if (dropdown) dropdown.style.display = 'none';
        return;
    }
    _fetchMentions(match[1], input);
}

async function _fetchMentions(q, input) {
    try {
        const res = await fetch(`/users/suggest?q=${encodeURIComponent(q)}`);
        const users = await res.json();
        const wrap = input.closest('.comment-form-wrap');
        const dropdown = wrap?.querySelector('.mention-dropdown');
        if (!dropdown) return;
        if (!users.length) { dropdown.style.display = 'none'; return; }
        dropdown.innerHTML = users.map(u =>
            `<div class="mention-item" data-id="${u._id}" data-nom="${u.nom}">` +
            `<img src="${u.photoProfil}" alt=""><span>${u.nom}</span></div>`
        ).join('');
        dropdown.style.display = 'block';
    } catch(e) {}
}

function _insertMention(mentionItem) {
    const nom = mentionItem.dataset.nom;
    const userId = mentionItem.dataset.id;
    const wrap = mentionItem.closest('.comment-form-wrap');
    const input = wrap?.querySelector('input[name="texte"]');
    const form = wrap?.querySelector('.ajax-comment-form');
    const dropdown = wrap?.querySelector('.mention-dropdown');
    if (!input) return;
    const val = input.value;
    const cursor = input.selectionStart || val.length;
    const newText = val.slice(0, cursor).replace(/@\w*$/, `@${nom} `) + val.slice(cursor);
    input.value = newText;
    if (form) {
        let ids = [];
        try { ids = JSON.parse(form.dataset.mentionIds || '[]'); } catch(e) {}
        if (!ids.includes(userId)) ids.push(userId);
        form.dataset.mentionIds = JSON.stringify(ids);
    }
    if (dropdown) dropdown.style.display = 'none';
    input.focus();
    const pos = newText.indexOf(nom) + nom.length + 2;
    input.setSelectionRange(pos, pos);
}

async function handleComment(form) {
    const postId = form.dataset.id || form.getAttribute('data-post-id');
    if (!postId) return;

    const input = form.querySelector('input[name="texte"]');
    if (!input) return;
    const texte = input.value.trim();
    if (!texte) return;

    const submitBtn = form.querySelector('button[type="submit"], button');
    if (submitBtn) submitBtn.disabled = true;

    const replyToUserId = form.dataset.replyToUserId || null;
    const replyToNom = form.dataset.replyToNom || null;
    let mentionIds = [];
    try { mentionIds = JSON.parse(form.dataset.mentionIds || '[]'); } catch(e) {}

    try {
        const body = { texte };
        if (replyToUserId && replyToNom) body.replyTo = { userId: replyToUserId, nom: replyToNom };
        if (mentionIds.length) body.mentionIds = mentionIds;

        const res = await fetch(`/post/${postId}/comment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.success) {
            const commentsSection = document.getElementById(`comments-${postId}`);
            if (commentsSection) {
                const commentsList = commentsSection.querySelector('.comments-list');
                const replyTag = data.comment.replyTo ? `<span class="comment-reply-tag">↩ @${data.comment.replyTo.nom}</span>` : '';
                const commentDiv = document.createElement('div');
                commentDiv.className = 'comment';
                commentDiv.dataset.commentId = data.comment._id;
                commentDiv.dataset.postId = postId;
                commentDiv.innerHTML = `
                    <img src="${data.comment.auteur.photoProfil}" class="comment-avatar" alt="">
                    <div class="comment-right">
                        <div class="comment-bubble">
                            <div class="comment-author">${data.comment.auteur.nom}</div>
                            ${replyTag}
                            <div class="comment-text">${data.comment.texte}</div>
                        </div>
                        <div class="comment-actions">
                            <button class="comment-like-btn"
                                    data-post="${postId}"
                                    data-comment="${data.comment._id}"
                                    data-reaction="">
                                <i class="fa-regular fa-heart"></i>
                            </button>
                            <button class="comment-reply-btn"
                                    data-post="${postId}"
                                    data-comment-author="${data.comment.auteur.nom}"
                                    data-comment-author-id="${data.comment.auteur._id}">Répondre</button>
                        </div>
                    </div>
                `;
                if (commentsList) commentsList.appendChild(commentDiv);
                else commentsSection.insertBefore(commentDiv, commentsSection.querySelector('.comment-form-wrap'));
                const countSpan = form.closest('.post')?.querySelector('.comments-count');
                if (countSpan) countSpan.textContent = data.commentsCount;
            }
            input.value = '';
            form.dataset.mentionIds = '[]';
            _clearReplyMode(form);
        }
    } catch (err) {
        console.error('❌ Erreur commentaire:', err);
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

function toggleComments(btnOrPostId) {
    let postId;
    if (typeof btnOrPostId === 'string') {
        postId = btnOrPostId;
    } else {
        postId = btnOrPostId.dataset.id || btnOrPostId.getAttribute('data-post-id');
    }
    if (!postId) return;
    const section = document.getElementById(`comments-${postId}`);
    if (section) {
        section.style.display = section.style.display === 'none' ? 'block' : 'none';
    }
}
window.toggleComments = toggleComments;

async function handleDelete(btn) {
    const postId = btn.dataset.id || btn.getAttribute('data-post-id');
    if (!postId) return;
    if (!confirm('Supprimer cette publication ?')) return;

    try {
        const res = await fetch(`/post/${postId}/delete`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            const card = btn.closest('.post-card, .post');
            if (card) card.remove();
        }
    } catch (err) {
        console.error('❌ Erreur suppression:', err);
    }
}

async function handleShare(btn) {
    const postId = btn.dataset.id || btn.getAttribute('data-post-id');
    if (!postId) return;

    const message = prompt('Ajouter un commentaire à ton partage ? (facultatif)');
    if (message === null) return;

    try {
        const res = await fetch(`/post/${postId}/share`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message || '' })
        });
        const data = await res.json();
        if (data.success) {
            const feed = document.querySelector('.feed');
            if (feed) {
                const postHTML = createPostHTML(data.post);
                feed.insertAdjacentHTML('afterbegin', postHTML);
                const countSpan = btn.querySelector('.shares-count, [data-shares-count]');
                if (countSpan) countSpan.textContent = data.sharesCount;
            }
        } else {
            alert(data.error || 'Erreur lors du partage.');
        }
    } catch (err) {
        console.error('❌ Erreur partage:', err);
    }
}

// =====================================================
// 11. EFFETS DE PROFIL
// =====================================================
(function() {
    const FX = {
        butterfly: function(c1, c2) {
            return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 18" width="22" height="18">'
                + '<ellipse cx="6"  cy="5"  rx="6"   ry="5"   fill="' + c1 + '" opacity="0.92"/>'
                + '<ellipse cx="16" cy="5"  rx="6"   ry="5"   fill="' + c2 + '" opacity="0.92"/>'
                + '<ellipse cx="7"  cy="13" rx="4"   ry="3.5" fill="' + c1 + '" opacity="0.78"/>'
                + '<ellipse cx="15" cy="13" rx="4"   ry="3.5" fill="' + c2 + '" opacity="0.78"/>'
                + '<ellipse cx="11" cy="9"  rx="1.2" ry="6"   fill="#3b0764"/>'
                + '</svg>';
        },
        star: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18">'
            + '<polygon points="9,1 11.2,6.5 17.5,7 13,11 14.5,17.5 9,14 3.5,17.5 5,11 0.5,7 6.8,6.5" fill="#fbbf24"/>'
            + '</svg>',
        flame: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 22" width="14" height="22">'
            + '<path d="M7,22 C1,18 0,11 4,6 C4,10 6,11 7,8 C7,13 10,13 10,7 C14,12 13,18 7,22Z" fill="#f97316" opacity="0.95"/>'
            + '<path d="M7,20 C3,17 2,12 5,8 C5,12 7,12 7,9 C7,13 9,12 9,9 C12,12 11,17 7,20Z"  fill="#fcd34d" opacity="0.85"/>'
            + '<path d="M7,18 C5,16 4.5,12 6,10 C6,13 7.5,13 7.5,11 C9,13 8.5,16 7,18Z"         fill="#fef3c7" opacity="0.7"/>'
            + '</svg>',
        sparkle: function(color) {
            return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="18" height="18">'
                + '<path d="M10,0 L11.8,8.2 L20,10 L11.8,11.8 L10,20 L8.2,11.8 L0,10 L8.2,8.2 Z" fill="' + color + '"/>'
                + '</svg>';
        },
        diamond: function(color) {
            return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 24" width="16" height="20">'
                + '<polygon points="10,0 20,8 10,24 0,8" fill="' + color + '" opacity="0.9"/>'
                + '<polygon points="10,0 20,8 10,10 0,8" fill="white" opacity="0.5"/>'
                + '<polygon points="5,8 10,0 15,8" fill="white" opacity="0.2"/>'
                + '</svg>';
        }
    };

    function makeOrbit(wrapper, orbitR, w, h, orbitDur, orbitDir, innerAnim, innerDur, delay, html) {
        var orbit = document.createElement('span');
        orbit.className = 'fx-orbit';
        orbit.style.cssText = 'position:absolute;top:50%;left:50%;width:0;height:0;pointer-events:none;z-index:10;'
            + 'animation:' + orbitDir + ' ' + orbitDur + 's linear ' + delay + 's infinite;';

        var inner = document.createElement('span');
        inner.className = 'fx-inner';
        inner.style.cssText = 'position:absolute;width:' + w + 'px;height:' + h + 'px;'
            + 'left:' + orbitR + 'px;top:' + (-h / 2) + 'px;display:block;pointer-events:none;'
            + 'animation:' + innerAnim + ' ' + innerDur + 's ease-in-out ' + delay + 's infinite;';
        inner.innerHTML = html;

        orbit.appendChild(inner);
        wrapper.appendChild(orbit);
    }

    function makeStatic(wrapper, angle, orbitR, w, h, anim, animDur, delay, html) {
        var rad = (angle * Math.PI) / 180;
        var x = Math.cos(rad) * orbitR;
        var y = Math.sin(rad) * orbitR;

        var p = document.createElement('span');
        p.className = 'fx-static';
        p.style.cssText = 'position:absolute;'
            + 'left:calc(50% + ' + x + 'px - ' + (w / 2) + 'px);'
            + 'top:calc(50% + ' + y + 'px - ' + (h / 2) + 'px);'
            + 'width:' + w + 'px;height:' + h + 'px;display:block;pointer-events:none;z-index:10;'
            + 'animation:' + anim + ' ' + animDur + 's ease-in-out ' + delay + 's infinite;';
        p.innerHTML = html;
        wrapper.appendChild(p);
    }

    window.initProfileEffects = function() {
        var selectors = '.effect-sparkle,.effect-flame,.effect-star,.effect-diamond,.effect-butterfly';
        document.querySelectorAll(selectors).forEach(function(wrapper) {
            if (wrapper.dataset.fxInit) return;
            wrapper.dataset.fxInit = '1';

            var img = wrapper.querySelector('img');
            if (!img) return;

            var imgW = img.offsetWidth;
            if (!imgW) {
                var cs = window.getComputedStyle(img);
                imgW = parseInt(cs.width) || 46;
            }
            var orbitR = Math.round(imgW / 2) + (imgW > 60 ? 22 : 14);
            var L = imgW > 60;

            wrapper.style.overflow = 'visible';
            if (wrapper.parentElement) wrapper.parentElement.style.overflow = 'visible';

            var type = '';
            wrapper.classList.forEach(function(c) { if (c.startsWith('effect-')) type = c.replace('effect-', ''); });
            if (!type) return;

            if (type === 'butterfly') {
                var bColors = [
                    ['#e879f9','#c026d3'],
                    ['#f0abfc','#a21caf'],
                    ['#c084fc','#7c3aed'],
                    ['#e879f9','#6d28d9']
                ];
                var bAngles = [0, 90, 180, 270];
                var bDurs   = [0.32, 0.38, 0.28, 0.35];
                var bDels   = [0, -0.1, -0.18, -0.26];
                var bw = L ? 28 : 18, bh = L ? 22 : 14;
                for (var i = 0; i < 4; i++) {
                    makeStatic(wrapper, bAngles[i], orbitR, bw, bh, 'fxWingFlap', bDurs[i], bDels[i], FX.butterfly(bColors[i][0], bColors[i][1]));
                }
            }

            if (type === 'flame') {
                var fAngles = [0, 72, 144, 216, 288];
                var fDurs   = [0.55, 0.65, 0.45, 0.70, 0.50];
                var fDels   = [0, -0.13, -0.25, -0.38, -0.48];
                var fw = L ? 18 : 12, fh = L ? 28 : 18;
                for (var i = 0; i < 5; i++) {
                    makeStatic(wrapper, fAngles[i], orbitR, fw, fh, 'fxFlicker', fDurs[i], fDels[i], FX.flame);
                }
            }

            if (type === 'star') {
                var sAngles = [0, 60, 120, 180, 240, 300];
                var sDurs   = [0.9, 1.1, 0.7, 1.3, 0.85, 1.0];
                var sDels   = [0, -0.15, -0.30, -0.45, -0.60, -0.75];
                var sw = L ? 24 : 15, sh = L ? 24 : 15;
                for (var i = 0; i < 6; i++) {
                    makeStatic(wrapper, sAngles[i], orbitR, sw, sh, 'fxTwinkle', sDurs[i], sDels[i], FX.star);
                }
            }

            if (type === 'sparkle') {
                var spColors = ['#a855f7','#818cf8','#e879f9','#6366f1','#c084fc','#38bdf8'];
                var spDurs   = [1.6, 2.0, 1.4, 1.8, 2.2, 1.5];
                var spDels   = [0, -0.5, -1.0, -1.5, -0.8, -1.3];
                var spw = L ? 24 : 16, sph = L ? 24 : 16;
                for (var i = 0; i < 6; i++) {
                    var ang = (i / 6) * 360 - 90;
                    makeStatic(wrapper, ang, orbitR, spw, sph, 'fxSparklePopIn', spDurs[i], spDels[i], FX.sparkle(spColors[i]));
                }
            }

            if (type === 'diamond') {
                var dColors = ['#67e8f9','#0ea5e9','#a5f3fc','#38bdf8','#7dd3fc'];
                var dAngles = [30, 102, 174, 246, 318];
                var dDurs   = [1.2, 1.8, 1.0, 1.5, 1.3];
                var dDels   = [0, -0.36, -0.72, -1.08, -1.44];
                var dw = L ? 20 : 13, dh = L ? 26 : 16;
                for (var i = 0; i < 5; i++) {
                    makeStatic(wrapper, dAngles[i], orbitR, dw, dh, 'fxDiamondGlint', dDurs[i], dDels[i], FX.diamond(dColors[i]));
                }
            }
        });
    };
}());

// =====================================================
// 12. NAVIGATION AJAX (SPA)
// =====================================================
let _spaScripts = [];
let _spaStyles = [];
let _isPopState = false; // flag pour distinguer navigation vs retour

const _progressBar = document.createElement('div');
_progressBar.id = 'spa-progress-bar';
document.body.appendChild(_progressBar);

let _progressTimer = null;
function _progressStart() {
    clearTimeout(_progressTimer);
    _progressBar.style.transition = 'none';
    _progressBar.style.width = '0%';
    _progressBar.classList.add('active');
    requestAnimationFrame(() => {
        _progressBar.style.transition = 'width 0.4s ease';
        _progressBar.style.width = '70%';
    });
}
function _progressDone() {
    _progressBar.style.transition = 'width 0.2s ease, opacity 0.3s ease 0.2s';
    _progressBar.style.width = '100%';
    _progressTimer = setTimeout(() => {
        _progressBar.classList.remove('active');
        _progressBar.style.width = '0%';
    }, 500);
}

async function navigateTo(url, pushState = true) {
    if (!url) return;
    // Autoriser le rechargement lors du retour arrière (popstate)
    // mais éviter la navigation inutile vers la même URL lors de clics normaux
    if (!_isPopState && url === window.location.href) return;
    if (url.includes('/logout')) { window.location.href = url; return; }

    _progressStart();

    try {
        const response = await fetch(url);
        if (!response.ok) { window.location.href = url; return; }

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        if (doc.body && doc.body.classList.contains('chat-page')) {
            window.location.href = url;
            return;
        }

        const newMain = doc.querySelector('.main-container');
        const curMain = document.querySelector('.main-container');
        if (!newMain || !curMain) { window.location.href = url; return; }

        _spaScripts.forEach(s => { try { s.remove(); } catch(e) {} });
        _spaScripts = [];
        _spaStyles.forEach(s => { try { s.remove(); } catch(e) {} });
        _spaStyles = [];

        const _styleNodes = [
            ...doc.querySelectorAll('head style'),
            ...Array.from(doc.querySelectorAll('body style')).filter(s => !newMain.contains(s))
        ];
        _styleNodes.forEach(oldStyle => {
            const s = document.createElement('style');
            s.setAttribute('data-spa', '1');
            s.textContent = oldStyle.textContent;
            document.head.appendChild(s);
            _spaStyles.push(s);
        });

        curMain.innerHTML = newMain.innerHTML;
        curMain.classList.remove('spa-fade-enter');
        void curMain.offsetWidth;
        curMain.classList.add('spa-fade-enter');

        const newTitle = doc.querySelector('title');
        if (newTitle) document.title = newTitle.textContent;

        document.querySelectorAll('.navbar a[href], .bottom-nav a[href]').forEach(a => {
            const aPath = new URL(a.href, location.origin).pathname;
            const curPath = new URL(url, location.origin).pathname;
            a.classList.toggle('active', aPath === curPath || (aPath !== '/' && curPath.startsWith(aPath)));
        });

        doc.querySelectorAll('body script:not([src])').forEach(oldScript => {
            const content = oldScript.textContent.trim();
            if (!content) return;
            const s = document.createElement('script');
            s.textContent = '(()=>{\n' + content + '\n})();';
            document.body.appendChild(s);
            _spaScripts.push(s);
        });

        doc.querySelectorAll('body script[src]').forEach(oldScript => {
            const src = oldScript.getAttribute('src');
            if (!src || document.querySelector(`script[src="${src}"]`)) return;
            const s = document.createElement('script');
            s.src = src;
            s.async = true;
            document.body.appendChild(s);
            _spaScripts.push(s);
        });

        requestAnimationFrame(() => { initProfileEffects(); });
        document.dispatchEvent(new CustomEvent('page-loaded', { detail: { url } }));

        if (pushState) {
            history.pushState({ url, scroll: 0 }, '', url);
        }
        window.scrollTo(0, 0);

    } catch (err) {
        console.log('Erreur navigation AJAX:', err);
        window.location.href = url;
    } finally {
        _progressDone();
        _isPopState = false;
    }
}

// Intercepte les clics sur les liens internes
document.addEventListener('click', function(e) {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href === '#' || href === '/logout') return;
    if (href.startsWith('http') || href.startsWith('//') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    if (a.hasAttribute('download')) return;
    if (a.getAttribute('target') && a.getAttribute('target') !== '_self') return;
    e.preventDefault();
    navigateTo(new URL(href, location.origin).href);
});

// Bouton retour/avant — fonctionne sur mobile et desktop
window.addEventListener('popstate', function(e) {
    const url = e.state?.url || window.location.href;
    _isPopState = true;
    navigateTo(url, false);
});

// =====================================================
// 13. DÉMARRAGE
// =====================================================
window.addEventListener('load', function() { 
    initProfileEffects();
});
console.log('📦 main.js chargé');
