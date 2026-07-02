// Autorise lettres (avec accents), chiffres, espaces, tirets et apostrophes
// Refuse emojis et caractères spéciaux/symboles
const NOM_REGEX = /^[a-zA-ZÀ-ÖØ-öø-ÿ0-9 '\-]{2,30}$/

function nomValide(nom) {
    if (!nom || typeof nom !== "string") return false
    const trimmed = nom.trim()
    if (trimmed.length < 2 || trimmed.length > 30) return false
    return NOM_REGEX.test(trimmed)
}

module.exports = { nomValide, NOM_REGEX }
