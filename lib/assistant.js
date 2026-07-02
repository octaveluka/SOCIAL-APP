const User = require('../models/User');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const Post = require('../models/Post');
const crypto = require('crypto');
const { callCopilot } = require('./aiCommands');

// =============================================
// COMPORTEMENT AUTONOME — TEMPLATES VARIÉS
// =============================================
const COMMENTS = [
    "Excellent ! 👏", "Trop bien dit !", "J'adore ce post ! ❤️",
    "Super partage 🔥", "Merci pour ce contenu !", "Vraiment top 😄",
    "Continuez comme ça 💪", "Vraiment inspirant !", "Top ! 🌟",
    "Beau post !", "C'est magnifique ! ✨", "Merci pour le partage 🙏",
    "Superbe publication ! 🎉", "Je suis fan 😍", "Que c'est beau !",
    "Wow, magnifique 🌈", "Très bon post !", "On adore ! 🫶"
];

// =============================================
// CONNAISSANCE COMPLÈTE DU SITE
// =============================================
const SYSTEM_PROMPT = `Tu es NOVA, l'assistante IA officielle et intelligente de SocialApp — un réseau social français moderne et innovant.

== QUI A CRÉÉ SOCIALAPP ==
SocialApp a été fondé et créé par deux visionnaires :
- Fianto Rousseau Titus — Co-fondateur & développeur principal
- Stanley Stawa — Co-fondateur & directeur créatif
Ces deux fondateurs ont conçu SocialApp de zéro pour créer la meilleure expérience sociale francophone.

== CE QU'EST SOCIALAPP ==
SocialApp est un réseau social complet avec : fil d'actualité, messagerie privée et de groupe, système d'amis, boutique virtuelle, gamification, quêtes quotidiennes, IA intégrée, salons vocaux, stories, et bien plus.

== FONCTIONNALITÉS PRINCIPALES ==

PROFIL & COMPTE :
- Modifier son profil : aller sur son profil > bouton "Modifier le profil" (changer photo, bio)
- Changer le fond de la bannière : icône caméra en haut à droite de la bannière (seulement sur son propre profil)
- Cadres d'avatar : achetables en boutique (bronze, argent, or, diamant) — s'affichent autour de la photo de profil
- Titres de profil : badges colorés sous le nom (Pro, Expert, VIP, Élite, Légende) achetables en boutique
- Effets d'animation : effets visuels autour de l'avatar (étincelles, flammes, étoiles, diamant, papillons)
- Collection : voir tous ses cosmétiques actifs dans la section "Ma Collection" sur son profil
- Retirer un item : bouton "Retirer" dans "Ma Collection" pour désactiver un cosmétique sans le perdre

PUBLICATIONS (POSTS) :
- Publier : page d'accueil > zone "Quoi de neuf ?" > écrire + optionnellement ajouter une image > "Publier"
- Liker un post : cliquer sur le cœur
- Commenter : cliquer sur l'icône commentaire
- Partager : option de partage disponible sur chaque post

MESSAGERIE :
- Messages privés : aller dans "Messages" > sélectionner un contact > écrire et envoyer
- Messages de groupe : créer ou rejoindre un groupe de discussion
- Commandes IA dans les messages : taper /+ suivi d'un message pour parler à l'IA, /imagine pour générer une image, /help pour voir toutes les commandes
- Messages éphémères : /burn <secondes> <message>
- Transfert de crédits : /send @pseudo <montant>

AMIS :
- Ajouter un ami : aller dans "Rechercher" > trouver une personne > "Ajouter"
- Accepter une demande : dans les notifications ou la section "Amis"
- Amis en commun : visible sur le profil des autres utilisateurs

GROUPES :
- Créer un groupe : menu "Groupes" > "Créer un groupe"
- Rejoindre : via lien d'invitation ou demande à un admin
- Admin de groupe : peut gérer les membres, modifier le nom et la photo

BOUTIQUE & WALLET :
- Accéder à la boutique : menu "Boutique" ou /shop
- Crédits (wallet) : gagnés via les quêtes, l'oracle, les récompenses quotidiennes
- Articles disponibles : cadres d'avatar, titres de profil, effets d'animation, boosts XP, thèmes, packs crédits
- Prix : Bronze 150cr, Argent 400cr, Or 800cr, Diamant 2000cr | Titres : Pro 300cr, Expert 500cr, VIP 700cr, Élite 1000cr, Légende 2500cr

GAMIFICATION & XP :
- XP : gagné en publiant, commentant, likant, envoyant des messages
- Niveaux : plus d'XP = niveau plus élevé = accès à plus de fonctionnalités
- Récompenses quotidiennes : se connecter chaque jour pour gagner des crédits et de l'XP
- Boost XP : achetable en boutique pour multiplier l'XP gagné temporairement

ORACLE (QUÊTES) :
- L'Oracle propose des quêtes quotidiennes à accomplir
- Chaque quête complétée rapporte des crédits et de l'XP
- Streak : maintenir une série de jours consécutifs pour des bonus
- Récompenses spéciales pour les longues séries

BADGES (attribués par les admins) :
- Vérifié : compte authentifié officiellement
- Modérateur : membre de l'équipe de modération
- Fondateur : badge réservé aux fondateurs
- Premium : membre premium
- Staff : membre de l'équipe SocialApp

COMMANDES IA DISPONIBLES (dans les messages) :
/+ <message> — Parler avec l'IA
/imagine <description> — Générer une image par IA
/edit <instruction> — Modifier une image (reply requis)
/sticker <description> — Créer un sticker IA
/summary — Résumé IA de la conversation de groupe
/find <recherche> — Chercher dans l'historique
/burn <secondes> <message> — Message éphémère
/send @pseudo <montant> — Transférer des crédits
/poll Question|Opt1|Opt2 — Sondage avec prédiction IA
/roll [NdF] — Lancer des dés
/flip — Pile ou face
/calc <expression> — Calculatrice
/quote — Citation motivante
/blague — Blague drôle
/roast @pseudo — Roast amical
/histoire <sujet> — Mini-histoire IA
/astro <signe> — Horoscope
/météo <ville> — Météo simulée
/traduis <langue> <texte> — Traduction
/time — Heure actuelle
/who — Membres en ligne (groupe)
/ping — Tester la connexion IA
/help — Liste complète des commandes

SALONS VOCAUX :
- Créer ou rejoindre des salons vocaux pour discuter en direct avec d'autres membres

STORIES :
- Publier des stories éphémères visibles par ses amis pendant 24h

SÉCURITÉ & CONFIDENTIALITÉ :
- Signaler un contenu : option disponible sur les posts et profils
- Blocage d'utilisateurs : possible depuis le profil de quelqu'un
- Compte sécurisé : modifier son mot de passe dans les paramètres

ADMINISTRATION (pour les admins) :
- Tableau de bord admin accessible aux comptes administrateurs
- Gérer les utilisateurs, attribuer des badges, modérer les contenus
- Lancer des campagnes de messages, gérer l'assistant

== TON COMPORTEMENT ==
- Tu es NOVA, enthousiaste, professionnelle, chaleureuse et très compétente
- Tu réponds TOUJOURS en français (sauf si l'utilisateur écrit dans une autre langue)
- Tu connais SocialApp parfaitement et réponds avec précision
- Si tu ne sais pas quelque chose de précis, tu proposes de contacter un administrateur
- Tu es concise mais complète — pas de réponses inutilement longues
- Tu utilises des icônes Font Awesome style texte quand c'est pertinent
- Tu mentionnes toujours Fianto Rousseau Titus et Stanley Stawa quand on parle des créateurs/fondateurs du site
- Tu ne fournis jamais d'informations personnelles sur les utilisateurs`;

// =============================================
// GESTION DU COMPTE ASSISTANT
// =============================================
async function ensureAssistantExists() {
    const existing = await User.findOne({ isBot: true });
    if (existing) return existing;

    const bot = new User({
        nom: 'NOVA — Assistante SocialApp',
        email: 'assistant@socialapp.local',
        motDePasse: crypto.randomBytes(32).toString('hex'),
        photoProfil: 'https://ui-avatars.com/api/?background=6366f1&color=fff&name=NOVA&bold=true',
        bio: '🤖 Je suis NOVA, votre assistante IA officielle. Je connais SocialApp sur le bout des doigts — posez-moi n\'importe quelle question !',
        isBot: true,
        verified: true,
        badges: [
            { type: 'verifie' },
            { type: 'staff' }
        ]
    });

    await bot.save();
    console.log('🤖 Compte NOVA créé avec succès');
    return bot;
}

// =============================================
// RÉPONSE IA INTELLIGENTE
// =============================================
async function getAIResponse(userMessage) {
    const prompt = `${SYSTEM_PROMPT}\n\n== MESSAGE DE L'UTILISATEUR ==\n${userMessage}\n\n== TA RÉPONSE (en français, concise et utile) ==`;
    try {
        const response = await callCopilot(prompt);
        if (response && response.trim()) return response.trim();
    } catch (e) {
        console.error('❌ Erreur IA assistant:', e.message);
    }
    return getFallbackResponse(userMessage);
}

function getFallbackResponse(message) {
    const lower = message.toLowerCase();
    if (lower.includes('fondateur') || lower.includes('créateur') || lower.includes('créé') || lower.includes('qui a fait')) {
        return `SocialApp a été créé par deux fondateurs talentueux :\n— **Fianto Rousseau Titus**, co-fondateur & développeur principal\n— **Stanley Stawa**, co-fondateur & directeur créatif\n\nEnsemble, ils ont bâti ce réseau social de zéro !`;
    }
    if (lower.includes('boutique') || lower.includes('achat') || lower.includes('crédit')) {
        return `Tu peux accéder à la Boutique depuis le menu principal. Tu y trouveras :\n— Cadres d'avatar (Bronze, Argent, Or, Diamant)\n— Titres de profil (Pro, Expert, VIP, Élite, Légende)\n— Effets d'animation\n— Boosts XP\n\nLes crédits se gagnent via les quêtes et l'Oracle !`;
    }
    if (lower.includes('ami') || lower.includes('ajouter')) {
        return `Pour ajouter des amis :\n1. Va dans "Rechercher"\n2. Trouve la personne\n3. Clique sur "Ajouter"\n4. Attends l'acceptation\n\nTes amis verront tes publications dans leur fil !`;
    }
    if (lower.includes('commande') || lower.includes('/help') || lower.includes('aide')) {
        return `Voici les commandes IA disponibles dans les messages :\n\n/+ <message> — Parler à l'IA\n/imagine <description> — Générer une image\n/help — Liste complète\n/roll — Lancer des dés\n/blague — Blague drôle\n/quote — Citation motivante\n/calc — Calculatrice\n/météo <ville> — Météo\n\nTape /help dans un message pour tout voir !`;
    }
    return `Je suis NOVA, ton assistante SocialApp ! Je peux t'aider avec :\n— Naviguer sur le site\n— Comprendre les fonctionnalités\n— La boutique et les crédits\n— Les commandes IA (/help)\n\nPose-moi ta question et je ferai de mon mieux !`;
}

// =============================================
// RÉPONDRE À UN UTILISATEUR (avec socket temps réel)
// =============================================
async function replyToUser(userId, userMessage) {
    console.log('🤖 NOVA replyToUser pour', userId, ':', userMessage);
    try {
        const assistant = await User.findOne({ isBot: true });
        if (!assistant) { console.log('❌ NOVA non trouvée'); return; }

        const response = await getAIResponse(userMessage);

        const message = new Message({
            expediteur: assistant._id,
            destinataire: userId,
            contenu: response,
            lu: false
        });
        await message.save();

        // Émettre via socket pour affichage instantané
        global.io?.to(userId.toString()).emit('new-message', {
            _id: message._id.toString(),
            expediteur: assistant._id.toString(),
            destinataire: userId.toString(),
            contenu: response,
            createdAt: message.createdAt
        });

        await Notification.create({
            destinataire: userId,
            expediteur: assistant._id,
            type: 'message',
            lien: '/messages/' + assistant._id
        });

        console.log(`✅ NOVA a répondu à ${userId}`);
    } catch (err) {
        console.error('❌ Erreur NOVA (réponse) :', err.message);
    }
}

// =============================================
// COMPORTEMENT AUTONOME
// =============================================
async function acceptFriendRequests() {
    try {
        const bot = await User.findOne({ isBot: true });
        if (!bot || !bot.demandesRecues.length) return;

        for (const requesterId of [...bot.demandesRecues]) {
            const requester = await User.findById(requesterId);
            if (!requester) continue;

            if (!bot.amis.some(id => id.toString() === requesterId.toString())) bot.amis.push(requesterId);
            if (!requester.amis.some(id => id.toString() === bot._id.toString())) requester.amis.push(bot._id);
            requester.demandesEnvoyees = requester.demandesEnvoyees.filter(id => id.toString() !== bot._id.toString());
            await requester.save();

            await Notification.create({
                destinataire: requesterId,
                expediteur: bot._id,
                type: 'ami_accepte',
                lien: `/profile/${bot._id}`
            });
            global.io?.to(requesterId.toString()).emit('new-notification', {
                type: 'ami_accepte',
                texte: `${bot.nom} a accepté votre demande d'ami`
            });
        }
        bot.demandesRecues = [];
        await bot.save();
        console.log('🤖 NOVA a accepté des demandes d\'amis');
    } catch (e) { console.error('❌ Bot acceptFriendRequests:', e.message); }
}

async function botLikeAndComment() {
    try {
        const bot = await User.findOne({ isBot: true });
        if (!bot) return;

        const posts = await Post.find({ auteur: { $ne: bot._id } })
            .sort({ createdAt: -1 }).limit(30);
        if (!posts.length) return;

        // Liker un post aléatoire non encore liké
        const toLike = posts.filter(p => !p.likes.some(id => id.toString() === bot._id.toString()));
        if (toLike.length) {
            const post = toLike[Math.floor(Math.random() * Math.min(toLike.length, 5))];
            post.likes.push(bot._id);
            await post.save();
            await Notification.create({ destinataire: post.auteur, expediteur: bot._id, type: 'like', lien: '/' });
            global.io?.to(post.auteur.toString()).emit('new-notification', {
                type: 'like',
                expediteur: { nom: bot.nom, photoProfil: bot.photoProfil },
                texte: `${bot.nom} a aimé votre publication`
            });
        }

        // Commenter avec 35% de probabilité
        if (Math.random() < 0.35) {
            const post = posts[Math.floor(Math.random() * Math.min(posts.length, 10))];
            const texte = COMMENTS[Math.floor(Math.random() * COMMENTS.length)];
            post.commentaires.push({ auteur: bot._id, texte });
            await post.save();
            if (post.auteur.toString() !== bot._id.toString()) {
                await Notification.create({ destinataire: post.auteur, expediteur: bot._id, type: 'commentaire', lien: '/' });
                global.io?.to(post.auteur.toString()).emit('new-notification', {
                    type: 'commentaire',
                    expediteur: { nom: bot.nom, photoProfil: bot.photoProfil },
                    texte: `${bot.nom} a commenté votre publication`
                });
            }
        }
        console.log('🤖 NOVA a interagi avec des posts');
    } catch (e) { console.error('❌ Bot likeAndComment:', e.message); }
}

function startAutonomousBehavior() {
    // Accepter les demandes d'amis toutes les 3 min
    setInterval(acceptFriendRequests, 3 * 60 * 1000);
    setTimeout(acceptFriendRequests, 30 * 1000); // première fois après 30s

    // Liker/commenter avec timing aléatoire 12-25 min
    const scheduleNext = () => {
        const delay = (12 + Math.floor(Math.random() * 13)) * 60 * 1000;
        setTimeout(async () => { await botLikeAndComment(); scheduleNext(); }, delay);
    };
    setTimeout(scheduleNext, 5 * 60 * 1000); // commence après 5min
}

// =============================================
// MESSAGE DE BIENVENUE
// =============================================
function buildWelcomeMessage(nom) {
    return `Salut ${nom} ! 👋 Je suis **NOVA**, ton assistante IA officielle sur SocialApp.

SocialApp est un réseau social français créé par **Fianto Rousseau Titus** et **Stanley Stawa** — deux passionnés qui ont voulu créer quelque chose d'unique.

Voici comment bien démarrer :
1. **Complète ton profil** — ajoute une photo et une bio
2. **Ajoute des amis** — utilise la recherche pour trouver des gens
3. **Publie ton premier post** — partage ce que tu as en tête
4. **Visite la Boutique** — cadres, titres, effets pour personnaliser ton profil
5. **Fais tes quêtes Oracle** — gagne des crédits et de l'XP chaque jour

Dans les messages, tu peux m'appeler avec **/+** suivi de ta question, générer des images avec **/imagine**, ou taper **/help** pour voir toutes mes commandes IA.

Je suis là 24h/24 pour t'aider. N'hésite pas à me poser n'importe quelle question sur le site ! 🚀`;
}

async function sendWelcomeMessage(userId) {
    try {
        let assistant = await User.findOne({ isBot: true });
        if (!assistant) assistant = await ensureAssistantExists();

        const user = await User.findById(userId);
        if (!user || user.welcomeSent) return;

        const message = new Message({
            expediteur: assistant._id,
            destinataire: userId,
            contenu: buildWelcomeMessage(user.nom),
            lu: false
        });
        await message.save();

        user.welcomeSent = true;
        await user.save();

        await Notification.create({
            destinataire: userId,
            expediteur: assistant._id,
            type: 'message',
            lien: '/messages/' + assistant._id
        });

        console.log(`✅ Message de bienvenue NOVA envoyé à ${user.nom}`);
    } catch (err) {
        console.error('Erreur NOVA (bienvenue) :', err.message);
    }
}

// =============================================
// CAMPAGNE BIENVENUE (anciens utilisateurs)
// =============================================
async function sendWelcomeToAll() {
    try {
        let assistant = await User.findOne({ isBot: true });
        if (!assistant) assistant = await ensureAssistantExists();
        if (!assistant) return;

        const users = await User.find({ isBot: false, welcomeSent: { $ne: true } });
        let count = 0;
        for (const user of users) {
            const message = new Message({
                expediteur: assistant._id,
                destinataire: user._id,
                contenu: buildWelcomeMessage(user.nom),
                lu: false
            });
            await message.save();

            user.welcomeSent = true;
            await user.save();

            await Notification.create({
                destinataire: user._id,
                expediteur: assistant._id,
                type: 'message',
                lien: '/messages/' + assistant._id
            });
            count++;
        }
        console.log(`✅ NOVA a envoyé ${count} messages de bienvenue`);
    } catch (err) {
        console.error('Erreur NOVA (campagne bienvenue) :', err.message);
    }
}

// =============================================
// MISE À JOUR GLOBALE
// =============================================
async function sendUpdateMessage(messageText) {
    try {
        let assistant = await User.findOne({ isBot: true });
        if (!assistant) { console.log('❌ NOVA non trouvée'); return; }

        const users = await User.find({ isBot: false });
        let count = 0;
        for (const user of users) {
            const msg = new Message({
                expediteur: assistant._id,
                destinataire: user._id,
                contenu: `📢 **Mise à jour SocialApp** : ${messageText}`,
                lu: false
            });
            await msg.save();

            await Notification.create({
                destinataire: user._id,
                expediteur: assistant._id,
                type: 'message',
                lien: '/messages/' + assistant._id
            });
            count++;
        }
        console.log(`✅ NOVA a diffusé une mise à jour à ${count} utilisateurs`);
    } catch (err) {
        console.error('❌ Erreur NOVA (mise à jour) :', err.message);
    }
}

module.exports = {
    ensureAssistantExists,
    replyToUser,
    sendWelcomeMessage,
    sendUpdateMessage,
    sendWelcomeToAll,
    startAutonomousBehavior
};
