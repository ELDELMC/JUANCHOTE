const fs = require('fs');
const path = require('path');

const MUTED_FILE = path.join(__dirname, '../data/muted.json');

// Memory Cache
let mutedUsers = null;

function loadMuted() {
    if (mutedUsers) return mutedUsers;
    
    if (fs.existsSync(MUTED_FILE)) {
        try {
            mutedUsers = JSON.parse(fs.readFileSync(MUTED_FILE, 'utf-8'));
        } catch (e) {
            console.error("❌ Error cargando muted.json:", e);
            mutedUsers = {};
        }
    } else {
        mutedUsers = {};
    }
    return mutedUsers;
}

function saveMuted() {
    if (!mutedUsers) return;
    fs.writeFile(MUTED_FILE, JSON.stringify(mutedUsers, null, 2), (err) => {
        if (err) console.error("❌ Error al guardar asíncronamente en muted.json:", err);
    });
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
    const muted = loadMuted();
    if (!muted[groupId]) muted[groupId] = {};
    muted[groupId][userId] = expiration;
    saveMuted();
}

/**
 * Desmutea a un usuario.
 */
function unmuteUser(groupId, userId) {
    const muted = loadMuted();
    if (muted[groupId] && muted[groupId][userId]) {
        delete muted[groupId][userId];
        if (Object.keys(muted[groupId]).length === 0) delete muted[groupId];
        saveMuted();
    }
}

/**
 * Verifica si un usuario está silenciado. Limpia expirados automáticamente.
 */
function isUserMuted(groupId, userId) {
    const muted = loadMuted();
    if (!muted[groupId] || !muted[groupId][userId]) return false;

    const expiration = muted[groupId][userId];
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
