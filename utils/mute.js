const fs = require('fs');
const path = require('path');

const MUTED_FILE = path.join(__dirname, '../data/muted.json');

// Cargar datos iniciales
let mutedUsers = {};
if (fs.existsSync(MUTED_FILE)) {
    try {
        mutedUsers = JSON.parse(fs.readFileSync(MUTED_FILE, 'utf-8'));
    } catch (e) {
        console.error("Error cargando muted.json:", e);
        mutedUsers = {};
    }
}

function saveMuted() {
    fs.writeFileSync(MUTED_FILE, JSON.stringify(mutedUsers, null, 2));
}

/**
 * Calcula la fecha de expiración basada en un string de duración.
 * s=seg, m=min, h=hora, d=dia, M=mes, a=año
 */
function parseDuration(durationStr) {
    const match = durationStr.match(/^(\d+)([smhdMa])$/);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2];

    const now = Date.now();
    let ms = 0;

    switch (unit) {
        case 's': ms = value * 1000; break;
        case 'm': ms = value * 60 * 1000; break;
        case 'h': ms = value * 60 * 60 * 1000; break;
        case 'd': ms = value * 24 * 60 * 60 * 1000; break;
        case 'M': ms = value * 30 * 24 * 60 * 60 * 1000; break;
        case 'a': ms = value * 365 * 24 * 60 * 60 * 1000; break;
    }

    return now + ms;
}

/**
 * Mutea a un usuario en un grupo específico.
 */
function muteUser(groupId, userId, expiration) {
    if (!mutedUsers[groupId]) mutedUsers[groupId] = {};
    mutedUsers[groupId][userId] = expiration;
    saveMuted();
}

/**
 * Desmutea a un usuario.
 */
function unmuteUser(groupId, userId) {
    if (mutedUsers[groupId] && mutedUsers[groupId][userId]) {
        delete mutedUsers[groupId][userId];
        if (Object.keys(mutedUsers[groupId]).length === 0) delete mutedUsers[groupId];
        saveMuted();
    }
}

/**
 * Verifica si un usuario está silenciado. Limpia expirados automáticamente.
 */
function isUserMuted(groupId, userId) {
    if (!mutedUsers[groupId] || !mutedUsers[groupId][userId]) return false;

    const expiration = mutedUsers[groupId][userId];
    if (Date.now() > expiration) {
        unmuteUser(groupId, userId);
        return false;
    }

    return true;
}

module.exports = {
    parseDuration,
    muteUser,
    unmuteUser,
    isUserMuted
};
