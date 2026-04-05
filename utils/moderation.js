const { getGroupSettings } = require('./settings');
const { getIsAdmin } = require('./helpers');

/**
 * 🛡️ Middleware de Moderación
 * Maneja Antilink y Antispam para grupos.
 * @returns {Boolean} true si el mensaje fue manejado (eliminado/advertido), false si puede continuar.
 */
async function handleModeration(sock, from, sender, msg, text) {
    const settings = getGroupSettings(from);
    const isAdmin = await getIsAdmin(sock, from, sender);

    // 🛑 Antilink
    if (settings.antilink && !isAdmin) {
        const urlRegex = /https?:\/\/(chat\.whatsapp\.com\/[^\s]+|whatsapp\.com\/[^\s]+)/gi;
        if (text.match(urlRegex)) {
            console.log(`🚫 Enlace detectado de ${sender}. Eliminando...`);
            await sock.sendMessage(from, { delete: msg.key });
            await sock.sendMessage(from, { 
                text: `⚠️ @_@ ${sender.split('@')[0]}, los enlaces están prohibidos aquí.` 
            }, { mentions: [sender] });
            return true;
        }
    }

    // 🛑 Antispam
    if (settings.antispam && !isAdmin) {
        if (!global.spamTracker) global.spamTracker = {};
        if (!global.spamTracker[from]) global.spamTracker[from] = {};

        const now = Date.now();
        const userLog = global.spamTracker[from][sender] || [];
        const recentMsgs = userLog.filter(ts => now - ts < 60000);

        recentMsgs.push(now);
        global.spamTracker[from][sender] = recentMsgs;

        if (recentMsgs.length > 5) {
            console.log(`🚫 Spam detectado de ${sender}.`);
            await sock.sendMessage(from, { delete: msg.key });
            return true;
        }
    }

    return false;
}

/**
 * Limpia el rastro de spam antiguo para evitar fugas de memoria
 */
function cleanSpamTracker() {
    if (!global.spamTracker) return;
    const now = Date.now();
    for (const group in global.spamTracker) {
        for (const user in global.spamTracker[group]) {
            global.spamTracker[group][user] = global.spamTracker[group][user].filter(ts => now - ts < 60000);
            if (global.spamTracker[group][user].length === 0) delete global.spamTracker[group][user];
        }
        if (Object.keys(global.spamTracker[group]).length === 0) delete global.spamTracker[group];
    }
}

module.exports = { handleModeration, cleanSpamTracker };
