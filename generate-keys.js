const webpush = require('web-push');


// Générer les clés VAPID
const keys = webpush.generateVAPIDKeys();

console.log('========================================');
console.log('🔑 VAPID KEYS - Copie ces clés');
console.log('========================================');
console.log('VAPID_PUBLIC_KEY=' + keys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);
console.log('========================================');
console.log('✅ Ajoute ces clés dans les variables');
console.log('   d\'environnement de Render (Settings → Environment Variables)');
console.log('========================================');
