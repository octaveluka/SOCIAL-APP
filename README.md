
# 🌐 SocialApp

Un réseau social complet développé avec Node.js, Express, MongoDB et Socket.io.



![Node.js](https://img.shields.io/badge/Node.js-18+-green)




![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-brightgreen)




![Socket.io](https://img.shields.io/badge/Socket.io-4.x-black)




![License](https://img.shields.io/badge/License-MIT-blue)



---

## ✨ Fonctionnalités

### 👤 Authentification
- Inscription avec validation stricte des noms
- Connexion sécurisée avec sessions
- Premier compte = administrateur automatiquement

### 📰 Fil d'actualité
- Publier des posts (texte + images)
- Liker et commenter sans rechargement (AJAX)
- Supprimer ses propres posts

### 👥 Système d'amis
- Rechercher des utilisateurs
- Envoyer / accepter / refuser / annuler des demandes
- Liste d'amis avec statut en ligne

### 💬 Messagerie en temps réel
- Chat privé avec Socket.io
- Indicateurs de lecture (✓ envoyé / ✓✓ lu)
- Statut en ligne / hors ligne en direct

### 👥 Groupes Messenger
- Créer un groupe avec photo
- Chat de groupe en temps réel
- Réactions aux messages (emojis)
- Répondre à un message (quote)
- Mentionner un membre (@pseudo)
- Pseudos personnalisés dans le groupe
- Lien d'invitation partageable
- Gestion des admins (promouvoir / rétrograder)
- Exclure un membre / quitter le groupe

### 🔔 Notifications
- Likes, commentaires, demandes d'amis
- Messages privés et mentions dans les groupes
- Badge de compteur en temps réel

### 🛡️ Dashboard Admin
- Statistiques globales (utilisateurs, posts, groupes, messages)
- Activer / désactiver des comptes
- Promouvoir / rétrograder des admins
- Supprimer des comptes définitivement
- Système de badges style Facebook :
  - ✅ Vérifié (bleu)
  - 🛡️ Modérateur (violet)
  - ⭐ Fondateur (or)
  - 👑 Premium (dégradé)
  - 🔧 Staff (vert)

### 🖼️ Images
- Upload via Cloudinary (profil, posts, groupes)
- Aperçu instantané avant envoi

---

## 🛠️ Stack technique

| Technologie | Usage |
|-------------|-------|
| Node.js + Express | Serveur web |
| MongoDB Atlas + Mongoose | Base de données |
| Socket.io | Temps réel (chat, notifications) |
| EJS | Templates HTML |
| Cloudinary | Stockage des images |
| bcryptjs | Hashage des mots de passe |
| express-session | Gestion des sessions |
| Font Awesome | Icônes |
| Inter (Google Fonts) | Typographie |

---

## 🚀 Installation locale

### Prérequis
- Node.js >= 18
- Un compte MongoDB Atlas (gratuit)
- Un compte Cloudinary (gratuit)

### Étapes

    # Cloner le repo
    git clone https://github.com/Rousseau-X/SOCIALAPP.git
    cd SOCIALAPP

    # Installer les dépendances
    npm install

    # Configurer les variables d'environnement
    cp .env.example .env
    # Édite .env avec tes propres clés

Créez un fichier .env à la racine :

    MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/socialapp
    SESSION_SECRET=une_phrase_secrete_longue_et_aleatoire
    CLOUDINARY_CLOUD_NAME=ton_cloud_name
    CLOUDINARY_API_KEY=ton_api_key
    CLOUDINARY_API_SECRET=ton_api_secret
    PORT=3000

Lancez le serveur :

    npm start

Ouvrez http://localhost:3000 dans votre navigateur.

---

## Structure du projet

    SOCIALAPP/
    ├── lib/
    │   ├── cloudinary.js          # Configuration Cloudinary
    │   └── validation.js          # Validation des noms
    ├── middleware/
    │   └── auth.js                # requireAuth + requireAdmin
    ├── models/
    │   ├── User.js                # Utilisateurs + badges
    │   ├── Post.js                # Publications
    │   ├── Message.js             # Messages privés + groupes
    │   ├── Group.js               # Groupes de discussion
    │   └── Notification.js        # Notifications
    ├── public/
    │   ├── css/
    │   │   └── style.css          # Design complet (Inter + variables CSS)
    │   └── js/
    │       └── feed.js            # AJAX likes/commentaires
    ├── routes/
    │   ├── auth.js                # Inscription / Connexion
    │   ├── feed.js                # Posts, likes, commentaires
    │   ├── profile.js             # Profil utilisateur
    │   ├── friends.js             # Amis + recherche
    │   ├── messages.js            # Messagerie privée
    │   ├── groups.js              # Groupes Messenger
    │   ├── notifications.js       # Notifications
    │   └── admin.js               # Dashboard admin
    ├── views/
    │   ├── partials/
    │   │   ├── head.ejs           # Balises head communes
    │   │   ├── navbar.ejs         # Navbar avec dropdown
    │   │   ├── sidebar.ejs        # Menu latéral
    │   │   └── badges.ejs         # Badges style Facebook
    │   ├── login.ejs              # Page connexion (split-screen)
    │   ├── register.ejs           # Page inscription (split-screen)
    │   ├── feed.ejs               # Fil d'actualité
    │   ├── profile.ejs            # Profil utilisateur
    │   ├── edit-profile.ejs       # Modifier le profil
    │   ├── friends.ejs            # Amis + demandes
    │   ├── search.ejs             # Recherche d'utilisateurs
    │   ├── messages.ejs           # Liste des conversations
    │   ├── chat.ejs               # Chat privé
    │   ├── notifications.ejs      # Notifications
    │   ├── group-chat.ejs         # Chat de groupe
    │   ├── group-settings.ejs     # Paramètres du groupe
    │   ├── new-group.ejs          # Créer un groupe
    │   ├── admin-dashboard.ejs    # Dashboard admin
    │   └── admin-users.ejs        # Gestion des utilisateurs
    ├── .env                       # Variables d'environnement (non commité)
    ├── .gitignore
    ├── package.json
    └── server.js                  # Point d'entrée principal

---

## Déploiement sur Render

1. Créez un compte sur https://render.com
2. New → Web Service → connectez votre dépôt GitHub
3. Configurez :
   - Build Command : npm install
   - Start Command : node server.js
   - Runtime : Node
4. Ajoutez les variables d'environnement dans l'onglet Environment
5. Cliquez Create Web Service et attendez le build

---

## Responsive

- Desktop – Layout 3 colonnes (sidebar + feed + sidebar droite)
- Tablette – Layout 1 colonne
- Mobile – Barre de navigation en bas (style Instagram)
- Chat mobile – Plein écran sans navbar

---

## Sécurité

- Mots de passe hashés avec bcryptjs
- Sessions sécurisées
- Validation des noms (pas d'emojis/symboles)
- Middleware d'authentification sur toutes les routes protégées
- Dashboard admin accessible uniquement aux administrateurs
- Comptes désactivés déconnectés automatiquement

---

## Auteur

FIANTO ROUSSEAU TITUS  
Développé avec ❤️ et beaucoup de café.

---

## Licence

MIT — libre d'utilisation et de modification.
# SOCIAL-APP
# SOCIAL-APP
"# SOCIAL-APP" 
