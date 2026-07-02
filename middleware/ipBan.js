const { getIp, checkIPBan } = require("../lib/intrusionDetection")

module.exports = async (req, res, next) => {
    const ip = getIp(req)
    const ban = await checkIPBan(ip)
    if (!ban) return next()

    const until = ban.permanent ? null : ban.bannedUntil
    const untilStr = until
        ? `jusqu'au ${new Date(until).toLocaleString("fr-FR")}`
        : "définitivement"

    if (req.xhr || req.headers.accept?.includes("application/json")) {
        return res.status(403).json({
            error: `Votre IP a été bannie ${untilStr}. Raison : ${ban.reason || "Non spécifiée"}`
        })
    }

    return res.status(403).send(`
        <!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
        <title>Accès bloqué</title>
        <style>
            body{font-family:system-ui,sans-serif;background:#0f172a;color:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
            .box{background:#1e293b;border:1px solid #ef4444;border-radius:12px;padding:40px;max-width:480px;text-align:center}
            h1{color:#ef4444;font-size:28px;margin:0 0 16px} p{color:#94a3b8;margin:8px 0} .reason{background:#0f172a;border-radius:8px;padding:12px;margin-top:16px;font-size:13px;color:#fca5a5}
        </style></head><body>
        <div class="box">
            <h1>🚫 Accès bloqué</h1>
            <p>Votre adresse IP a été bannie de cette plateforme.</p>
            <p><strong>${untilStr.charAt(0).toUpperCase() + untilStr.slice(1)}</strong></p>
            <div class="reason">Raison : ${ban.reason || "Non spécifiée"}</div>
        </div>
        </body></html>
    `)
}
