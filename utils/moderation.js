const { getGroupSettings } = require('./settings');
const { getIsAdmin } = require('./helpers');
const { sendStyledMessage } = require('./styles');
const { jidNormalizedUser } = require('@whiskeysockets/baileys');

/**
 * 🛡️ Middleware de Moderación (Soporta Multi-Bot)
 * Maneja Antilink y Antispam para grupos.
 * @returns {Boolean} true si el mensaje fue manejado, false si continuó.
 */
async function handleModeration(sock, from, sender, msg, text, isMain = false) {
    const settings = getGroupSettings(from);
    const senderIsAdmin = await getIsAdmin(sock, from, sender);
    
    // Si el que envió el mensaje es admin, no hacemos nada
    if (senderIsAdmin) return false;

    const botJid = jidNormalizedUser(sock.user.id);
    const metadata = await sock.groupMetadata(from);
    const iAmAdmin = metadata.participants.some(p => jidNormalizedUser(p.id) === botJid && p.admin);

    // 🛑 Antilink
    if (settings.antilink) {
        const urlRegex = /https?:\/\/(chat\.whatsapp\.com\/[^\s]+|whatsapp\.com\/[^\s]+)/gi;
        if (text.match(urlRegex)) {
            if (iAmAdmin) {
                console.log(`🚫 [MOD-${botJid}] Enlace detectado de ${sender}. Borrando...`);
                await sock.sendMessage(from, { delete: msg.key });
                
                // Solo el bot principal envía el mensaje de advertencia para no saturar el chat
                if (isMain) {
                    await sendStyledMessage(sock, from, "𝙴𝚗𝚕𝚊𝚌𝚎 𝙿𝚛𝚘𝚑𝚒𝚋𝚒𝚍𝚘", `@${sender.split('@')[0]}, los enlaces están prohibidos aquí.`);
                }
                return true;
            } else {
                console.warn(`📢 [MOD-${botJid}] Detecté un link pero NO SOY ADMIN en ${from}.`);
            }
        }
    }

    // 🛑 Antispam
    if (settings.antispam) {
        if (!global.spamTracker) global.spamTracker = {};
        if (!global.spamTracker[from]) global.spamTracker[from] = {};

        const now = Date.now();
        const userLog = global.spamTracker[from][sender] || [];
        const recentMsgs = userLog.filter(ts => now - ts < 60000);
        recentMsgs.push(now);
        global.spamTracker[from][sender] = recentMsgs;

        if (recentMsgs.length > 5) {
            if (iAmAdmin) {
                await sock.sendMessage(from, { delete: msg.key });
                return true;
            }
        }
    }

    return false;
}

module.exports = { handleModeration };
