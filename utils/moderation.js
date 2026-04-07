const { getGroupSettings } = require('./settings');
const { getIsAdmin } = require('./helpers');
const { sendStyledMessage } = require('./styles');
const { jidNormalizedUser } = require('@whiskeysockets/baileys');

/**
 * 🛡️ Middleware de Moderación (Soporta Multi-Bot + LID)
 */
async function handleModeration(sock, from, sender, msg, text, isMain = false) {
    const settings = getGroupSettings(from);
    
    // Verificamos si el que envía es admin
    const senderIsAdmin = await getIsAdmin(sock, from, sender);
    if (senderIsAdmin) return false;

    // 🤖 Verificar si YO (este bot) soy admin
    // El problema: sock.user.id = "573052274793@s.whatsapp.net"
    // Pero en el grupo puedo aparecer como un LID completamente diferente
    // Solución: intentar borrar directamente y dejar que el catch maneje el error
    
    // 🛑 Antilink
    if (settings.antilink) {
        const urlRegex = /https?:\/\/(chat\.whatsapp\.com\/[^\s]+|whatsapp\.com\/[^\s]+)/gi;
        if (text.match(urlRegex)) {
            try {
                await sock.sendMessage(from, { delete: msg.key });
                console.log(`🚫 [ANTILINK-OK] Link borrado por bot ${jidNormalizedUser(sock.user.id)}`);
                
                if (isMain) {
                    await sendStyledMessage(sock, from, "𝙴𝚗𝚕𝚊𝚌𝚎 𝙿𝚛𝚘𝚑𝚒𝚋𝚒𝚍𝚘", `@${sender.split('@')[0]}, prohibido enviar enlaces de grupos aquí.`);
                }
                return true;
            } catch (e) {
                // Si falla, este bot no es admin. Otro del enjambre lo intentará.
                console.warn(`📢 [ANTILINK] Bot no pudo borrar (probablemente no es admin).`);
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
            try {
                await sock.sendMessage(from, { delete: msg.key });
                return true;
            } catch (e) {}
        }
    }

    return false;
}

module.exports = { handleModeration };
