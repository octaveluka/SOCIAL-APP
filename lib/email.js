const { Resend } = require('resend');

function getResend() {
    if (!process.env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY is not configured. Email sending is unavailable.');
    }
    return new Resend(process.env.RESEND_API_KEY);
}

async function sendResetEmail(to, code) {
    try {
        const resend = getResend();
        const { data, error } = await resend.emails.send({
            from: 'SocialApp <onboarding@resend.dev>',
            to: [to],
            subject: '🔐 Réinitialisation de votre mot de passe',
            html: `
                <div style="font-family: Arial; max-width: 500px; margin: auto; background: #fff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <h2 style="text-align:center;">🔐 Réinitialisation du mot de passe</h2>
                    <p>Bonjour,</p>
                    <p>Vous avez demandé à réinitialiser votre mot de passe. Voici votre code de vérification :</p>
                    <div style="font-size: 32px; font-weight: bold; color: #4f46e5; text-align: center; padding: 20px; background: #eef2ff; border-radius: 8px; letter-spacing: 4px;">${code}</div>
                    <p>Ce code est valable pendant <strong>15 minutes</strong>.</p>
                    <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
                    <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">Application SocialApp</div>
                </div>
            `
        });

        if (error) {
            console.error('❌ Erreur Resend:', error);
            throw new Error(error.message);
        }

        console.log(`✅ Email envoyé à : ${to} (ID: ${data.id})`);
        return data;
    } catch (err) {
        console.error('❌ Erreur envoi email:', err.message);
        throw err;
    }
}

module.exports = { sendResetEmail };
