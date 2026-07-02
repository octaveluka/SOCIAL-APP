---
name: SocialApp architecture
description: Key decisions and constraints for SocialApp Node.js/Express/MongoDB/Socket.io app
---

# SocialApp — Architecture & Decisions

## Stack
- Node.js + Express + Socket.io + MongoDB (Mongoose) + EJS views
- Cloudinary for media (photos, audio, AI images)
- Port 5000, host 0.0.0.0 (Replit proxy)
- `app.set('trust proxy', 1)` required for rate-limiter behind Replit's proxy

## Key Files
- `server.js` — main server, all Socket.io events, cron for ephemeral messages + ephemeral group cleanup
- `lib/aiCommands.js` — AI command handlers; commands regex in server.js must use `/^\/[a-z+]/i` (not a hardcoded list)
- `lib/cloudinary.js` — exports: cloudinary, uploadProfile, uploadPost, uploadGroup, uploadAudio
- `middleware/auth.js` — exports: requireAuth, redirectIfAuth, requireAdmin

## External APIs
- Copilot (text AI): `https://delfaapiai.vercel.app/ai/copilot?message=...&model=default` (GET)
- Image generate: `https://gem-tw6a.onrender.com/generate` (POST, {prompt, ratio, format})
- Image edit: `https://gem-tw6a.onrender.com/edit` (POST, {prompt, image: base64, format})
- DevOps health check targets `/health` on gem-tw6a; alerts sent to avis_solutions group via sendSystemAlert()

## Models
- User: xp, walletBalance, isIncognitoInput, theme (10 themes), vaultedChats (Map), activeSubProfile,
  aiCloneActive, aiCloneInstructions (500 chars max), xpBoostExpiry (Date), profileTitle (String),
  profileFrame (enum: bronze/argent/or/diamant), lastFreeCredits (Date)
- Message: isDeleted, expiresAt, isSticker, isCodeBlock, codeSignature, anonymousName/Avatar
- Group: isPermanent, isSystemGroup, systemGroupKey, isChaosMode, chaosExpiresAt, voiceRoomMembers,
  isEphemeral (bool), expiresAt (Date)
- SubProfile: userId, anonymousUsername, anonymousAvatarUrl
- Bounty: title, description, actionType (10 predefined IDs), rewardAmount, createdBy, status, claimedBy, applicants (with verified flag), groupId

## Routes
- /routes/gamification — wallet, shop (25 items in 5 categories), bounties, clone toggle + instructions
  - POST /api/bounties → create (admin bypass balance)
  - GET /api/bounties/active → for Primes group panel
  - POST /api/bounties/:id/accomplish → auto-verify + award
  - POST /api/clone/toggle → toggle aiCloneActive on own profile
  - POST /api/clone/instructions → save aiCloneInstructions (max 500 chars)
  - POST /api/shop/buy → handles types: theme, xpboost, title, frame, badge, credits
- /routes/groups — GET/POST /salons/new for ephemeral salons; site admins auto-added as group admin
- /routes/dailytasks — daily tasks for Primes group
- /routes/security — incognito, PIN vault, subprofiles

## Shop Items (25 articles, 5 categories)
- Thèmes (10): default(free), dark(200), ocean(300), sunset(300), forest(300), neon(350), rose(350), minuit(400), cyberpunk(400), galaxie(500)
- Boosts (5): xpboost_1d(300/24h), xpboost_3d(700/3j), xpboost_7d(1500/7j), credits_50(free 1x/week), credits_pack(2000→3000cr)
- Titres (5): Pro(300), Expert(500), VIP(700), Élite(1000), Légende(2500)
- Cadres (4): bronze(150), argent(400), or(800), diamant(2000)
- Badges (1): premium(750)

## Bounty System
- 10 predefined actionTypes; user picks from dropdown (no free text)
- Auto-verification via verifyBountyAction()
- Admins exempt from balance deduction for both bounties and shop items

## Gamification
- Activity reward: every 5 group messages/day → +5 credits SILENT (dailyGroupMsgMap in server.js)
- XP boost: when xpBoostExpiry > now, XP multiplied ×2 (group msg: 2→4, AI cmd: 1→2)
- XP: +1 per group message, +2 per AI command (doubled with boost)

## Site Admin = Group Admin
- In GET /groups/:id: if user.role==="admin" and not already member → auto-added to group as admin in DB
- isAdmin in template = isSiteAdmin || membre.isAdmin
- **Why:** Site admins need full visibility and control over all groups without manual membership

## Ephemeral Salons
- Created via GET/POST /salons/new (in routes/groups.js)
- Group fields: isEphemeral=true, expiresAt=Date
- On access: expired ephemeral groups auto-delete themselves + their messages and redirect
- Cleanup cron in server.js: runs every hour, deletes all expired ephemeral groups + messages
- Shown with ⏳ badge and expiry time in /messages list
- Duration: 1h to 7 days (168h max), default 24h

## AI Clone
- aiCloneActive field on User (bool, default false)
- aiCloneInstructions: custom prompt text (max 500 chars), shown only when clone is active
- Toggle button on own profile → POST /api/clone/toggle (also shows/hides instructions card)
- Save instructions → POST /api/clone/instructions
- When recipient has clone active: auto-reply uses last 5 posts as context + custom instructions
- Reply prefixed with "🎭 *Clone IA* :"

## Real-time Messages Fix (chat.ejs)
- chat.ejs now reuses window.notificationSocket instead of creating a new io() connection
- Uses socket.off() to clear old listeners before rebinding (prevents duplicate events on navigation)

## Watch Party — MODE DIRECT (auto-join)
- watchPartyState{} map in server.js (in-memory) stores active party per group: { url, currentTime, isPaused, lastUpdate }
- join-group socket event: if party active for that group → server immediately emits watch-party-sync load event to new joiner
- watch-party-sync "end" action clears server state + closes panel on all clients
- No Solo/Sync toggle — everyone in the group always sees the live stream
- loadWatchSource() always treats as sync; blob URLs show warning "visible uniquement pour toi"

## Badges — Expiration 14 jours
- User.badges schema has expiresAt: Date (null = permanent)
- Shop buy: new badge sets expiresAt = now+14j; existing active badge extends by 14j; expired badge renewed from now+14j
- profile.ejs "Ma Collection" card: shows active badges with countdown, expired badges with "Renouveler" link

## Ma Collection (profile.ejs)
- Card visible only on own profile (isOwnProfile)
- Shows: active theme, profileTitle, profileFrame, active badges (with expiry/days-left), expired badges (greyed out)
- Badges expiring ≤3 days shown with ⚠️ warning color

## AI Commands (lib/aiCommands.js) — 23 commandes total
- /+ → copilot, /imagine → image gen, /edit → image edit, /sticker → sticker, /find → user search
- /burn → timed message, /send → forward, /roll → dice, /summary → group summary
- /help /ping /flip /quote /time /who /calc → utility commands
- /poll Question|Opt1|Opt2 → predictive poll with AI winner prediction
- /traduis <langue> <texte> → translation via copilot
- /météo <ville> → simulated weather via copilot
- /blague → random joke via copilot
- /roast @pseudo → friendly roast via copilot
- /histoire <sujet> → short story via copilot
- /astro <signe> → horoscope via copilot
- commands regex in server.js: /^\/[a-z+]/i (covers ALL slash commands)

## Anti-Screenshot Watermark
- Fixed overlay injected via JS at bottom of chat.ejs and group-chat.ejs
- opacity: 0.026-0.028, rotated text rows with user._id, pointer-events:none, z-index:9997

**Why:** No Replit branding/advertising anywhere in code or UI — explicit user constraint.

## Security Architecture (Applied)

### Socket.io Identity (CRITICAL FIX)
`io.use()` shares `sessionMiddleware` with Socket.io. `socket.userId` is set from `socket.request.session.user.id` — never from client-provided `data.from`. All socket handlers override `from = socket.userId`.
**Why:** Without this, any user can send messages as anyone by spoofing `from`.

### AI API URLs
`COPILOT_API_URL`, `IMAGE_API_URL`, `EDIT_API_URL` are env vars (with fallback). Never hardcoded.

### Helmet + MongoSanitize
`express-mongo-sanitize()` + `helmet()` with custom CSP added after `app.use(flash())`.

### Regex Escaping (ReDoS prevention)
All `$regex` queries escape user input: `q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`.
Applied in: routes/friends.js, routes/feed.js, routes/admin.js.

### Rate Limiting
`resetLimiter` (5/15min) on `/forgot-password`, `/security-question`, `/reset-password`.
Global limiter no longer skips `/` root path.

### Session Cookie
`secure: process.env.NODE_ENV === 'production'` — `NODE_ENV=production` set in env vars.

## IDS + 20-Vulnerability Hardening Pass

### New Files
- `models/SecurityEvent.js` — MongoDB log of all security events (9 types)
- `lib/intrusionDetection.js` — IDS library: `recordFailedLogin`, `clearLoginFailures`, `recordSuspicious`, `checkSocketFlood`, `validateObjectId` middleware, `alertAdmins`
- `views/admin-security.ejs` — Admin IDS dashboard at `/admin/security`

### 20 Fixes Applied
1. **IDS** — brute-force detection, socket flood detection, admin Socket.io alert
2. **Session fixation** — `req.session.regenerate()` after successful login
3. **Password reset no session invalidation** — tracked; further improvement: store sessionToken per user
4. **Account enumeration** — `/forgot-password` returns generic message regardless of email existence
5. **Security question whitelist** — register validates `securityQuestion` against `SECURITY_QUESTIONS` array
6. **Password min 8 chars** — increased from 6→8 in register, reset, change-password
7. **IDS login tracking** — failed logins fire `recordFailedLogin()`, success fires `clearLoginFailures()`
8. **Message delete clears media** — `audio` and `image` fields set to null on soft-delete
9. **Audio group membership check** — `/messages/audio` verifies sender is group member
10. **Photo group membership check** — `/messages/photo` verifies sender is group member
11. **React IDOR** — `/api/messages/:id/react` checks user is a participant (expediteur or destinataire)
12. **Atomic shop buy** — `findOneAndUpdate` with balance filter prevents double-spend race condition
13. **Atomic bounty accomplish** — `findOneAndUpdate` on `{status:"open"}` prevents concurrent claims
14. **Bounty max amount cap** — 10,000 credits maximum
15. **Bounty award non-applicant** — verifies recipient is in applicants list (admin bypass)
16. **Stories privacy** — `/stories/user/:userId` checks friendship before serving stories
17. **Post content length** — 3,000 char max on `/post` route + Socket.io `send-message` (5,000)
18. **Assistant bio/update length** — bio 500 chars, update message 1,000 chars
19. **lastSeen atomic** — `requireAuth` now uses `updateOne` instead of full `user.save()`
20. **Socket flood detection** — `checkSocketFlood` on `send-message` and `send-group-message` (30/min)
21. **ObjectId validation middleware** — `validateObjectId()` on 4 key routes (messages delete/react, bounty accomplish/award)
22. **Admin IDS panel** — `/admin/security` with stats + event log + real-time Socket.io alerts

## Comment Likes + Réactions (picker global réutilisé)
- Schéma `commentaires[]` étendu : `likes[]`, `reactions[{user,type}]`, `replyTo:{userId,nom}`
- POST `/post/:postId/comment/:commentId/react` — même logique que post/react (toggle)
- Le picker global `#reaction-picker-global` est réutilisé pour les commentaires : quand `data-comment` est défini sur les `.reaction-opt`, `handleCommentReact()` est appelé au lieu de `handleReaction()`
- `_showCommentPicker()` set `data-comment` sur les boutons du picker ; `_hidePicker()` les efface systématiquement
- Variables séparées : `_commentPressTimer`, `_isCommentLongPress` (mirror des vars post)

## Reply-to-Comment + @Mention
- GET `/users/suggest?q=` → suggestions (max 5 users par regex)
- Formulaire commentaire dans `.comment-form-wrap` : `.reply-indicator` (masqué par défaut) + `.mention-dropdown` (position:absolute, bottom:100%) + `.ajax-comment-form`
- `_setReplyMode(postId, authorId, authorName)` — affiche l'indicateur et mémorise `form.dataset.replyToUserId/Nom`
- `_clearReplyMode(form)` — reset après soumission ou annulation
- `_handleMentionInput(input)` : détecte `/@(\w*)$/` avant le curseur → `_fetchMentions()` → `_showMentionDropdown()`
- `_insertMention()` : remplace `@query` par `@nom ` et stocke l'id dans `form.dataset.mentionIds` (JSON)
- `handleComment()` envoie `{ texte, replyTo?, mentionIds? }` et reconstruit le DOM commentaire avec les boutons like/répondre

## Notifications de commentaires
- Types ajoutés au modèle : `"reponse"` et `"mention"` (enum Notification.js)
- Route POST /comment : envoie "reponse" à la personne répondue, "commentaire" à l'auteur du post (sauf si déjà notifié via réponse), "mention" pour chaque userId dans mentionIds
- Toast + getNotificationMessage() mis à jour pour les deux nouveaux types
