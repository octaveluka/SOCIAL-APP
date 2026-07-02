// ============================================================
// GÉNÉRATEUR D'AVATARS — styles variés, uniques par utilisateur
// ============================================================

const STYLES = [
    "adventurer",        // personnages cartoon, style animal/nature
    "lorelei",           // illustrations douces, style culturel
    "pixel-art",         // pixel art rétro, style jeu vidéo/culture
    "notionists",        // illustrations professionnelles, moderne
    "micah",             // personnages illustrés diversifiés
    "bottts",            // robots et machines, style tech/futuriste
    "fun-emoji",         // emojis expressifs, style festif
    "avataaars",         // avatars style réseau social classique
    "big-ears",          // personnages avec grandes oreilles, cute
    "croodles",          // doodles artistiques, style créatif
    "shapes",            // formes géométriques abstraites
    "rings",             // anneaux géométriques, style minimal
]

const BG_COLORS = [
    "b6e3f4",   // bleu ciel
    "c0aede",   // lavande
    "d1d4f9",   // indigo pastel
    "ffd5dc",   // rose
    "ffdfbf",   // pêche
    "c1f4c5",   // menthe
    "f5d0a9",   // sable
    "a9d7f5",   // bleu clair
    "f0c4f7",   // lilas
    "c4f0d4",   // vert menthe
    "f7e4c4",   // crème
    "c4d4f0",   // bleu gris
]

function hashCode(str) {
    let h = 0
    for (let i = 0; i < str.length; i++) {
        h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
    }
    return Math.abs(h)
}

/**
 * Génère une URL d'avatar DiceBear unique et déterministe
 * basée sur l'userId — même user = même avatar à chaque fois
 */
function generateAvatar(userId) {
    const id = userId.toString()
    const hash = hashCode(id)
    const style = STYLES[hash % STYLES.length]
    const bg = BG_COLORS[(hash >> 4) % BG_COLORS.length]
    return `https://api.dicebear.com/9.x/${style}/png?seed=${id}&size=200&backgroundColor=${bg}`
}

/**
 * Retourne true si l'URL est un avatar par défaut (ui-avatars.com)
 * et doit être remplacé
 */
function isDefaultAvatar(url) {
    if (!url) return true
    return url.includes("ui-avatars.com") && url.includes("name=User")
}

module.exports = { generateAvatar, isDefaultAvatar }
