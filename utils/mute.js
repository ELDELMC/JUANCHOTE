const fs = require('fs');
const path = require('path');

const MUTED_FILE = path.join(__dirname, '../data/muted.json');

let mutedUsers = null;

function loadMuted() {
    if (mutedUsers) return mutedUsers;
    if (fs.existsSync(MUTED_FILE)) {
        try {
            mutedUsers = JSON.parse(fs.readFileSync(MUTED_FILE, 'utf-8'));
        } catch (e) {
            mutedUsers = {};
        }
    } else {
        mutedUsers = {};
    }
    return mutedUsers;
}

function saveMuted() {
    if (!mutedUsers) return;
    if (!fs.existsSync(path.dirname(MUTED_FILE))) fs.mkdirSync(path.dirname(MUTED_FILE), { recursive: true });
    fs.writeFileSync(MUTED_FILE, JSON.stringify(mutedUsers, null, 2));
}

function parseDuration(durationStr) {
    const match = durationStr.match(/^(\d+)([smhdMa]$/);
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

function muteUser(groupId, userId, expiration) {
    const muted = loadMuted();
    if (!muted[groupId]) muted[groupId] = {};
    
    // Guardamos el usuario. Si es LID o número, se guarda tal cual.
    muted[groupId][userId] = expiration;
    saveMuted();
}

function unmuteUser(groupId, userId) {
    const muted = loadMuted();
    if (muted[groupId] && muted[groupId][userId]) {
        delete muted[groupId][userId];
        if (Object.keys(muted[groupId]).length === 0) delete muted[groupId];
        saveMuted();
    }
}

/**
 * 🔒 VERIFICACIÓN REFORZADA
 * Compara IDs de forma flexible para atrapar LIDs y Números Reales
 */
function isUserMuted(groupId, userId) {
    const muted = loadMuted();
    if (!muted[groupId]) return false;

    // 1. Verificación directa
    if (muted[groupId][userId]) {
        if (Date.now() > muted[groupId][userId]) {
            unmuteUser(groupId, userId);
            return false;
        }
        return true;
    }

    // 2. Verificación por "Prefijo de número" (Para LIDs)
    // A veces el mute se guarda como @lid y llega como @s.whatsapp.net o viceversa
    const userPrefix = userId.split('@')[0];
    for (const savedJid of Object.keys(muted[groupId])) {
        if (savedJid.startsWith(userPrefix)) {
            if (Date.now() > muted[groupId][savedJid]) {
                unmuteUser(groupId, savedJid);
                return false;
            }
            return true;
        }
    }

    return false;
}

module.exports = {
    parseDuration,
    muteUser,
    unmuteUser,
    isUserMuted
};
