const { getGroupSettings } = require('./settings');
const { getIsAdmin } = require('./helpers');
const { sendStyledMessage } = require('./styles');
const { jidNormalizedUser } = require('@whiskeysockets/baileys');

/**
 * 🛡️ Middleware de Moderación (Soporta Multi-Bot)
 * Maneja Antilink y Antispam para grupos.
 */
async function handleModeration(sock, from, sender, msg, text, isMain = false) {
    const settings = getGroupSettings(from);
    
    // Verificamos si el que envía es admin (para no borrarle nada)
    const senderIsAdmin = await getIsAdmin(sock, from, sender);
    if (senderIsAdmin) return false;

    // 🤖 Verificamos si YO soy admin
    // Usamos jidNormalizedUser para limpiar el :1, :2 etc del ID del bot
    const botJid = jidNormalizedUser(sock.user.id);
    const metadata = await sock.groupMetadata(from);
    
    const botParticipant = metadata.participants.find(p => jidNormalizedUser(p.id) === botJid);
    // IMPORTANTE: p.admin puede ser 'admin', 'superadmin' o undefined
    const iAmAdmin = botParticipant && (botParticipant.admin === 'admin' || botParticipant.admin === 'superadmin');

    // 🛑 Antilink
    if (settings.antilink) {
        const urlRegex = /https?:\/\/(chat\.whatsapp\.com\/[^\s]+|whatsapp\.com\/[^\s]+)/gi;
        if (text.match(urlRegex)) {
            if (iAmAdmin) {
                console.log(`🚫 [MODERATOR-OK] Link borrado por ${botJid}`);
                await sock.sendMessage(from, { delete: msg.key });
                
                if (isMain) {
                    await sendStyledMessage(sock, from, "𝙴𝚗𝚕𝚊𝚌𝚎 𝙿𝚛𝚘𝚑𝚒𝚋𝚒𝚍𝚘", `@${sender.split('@')[0]}, prohibido enviar enlaces de grupos aquí.`);
                }
                return true;
            } else {
                // Si el bot dice que no es admin y tú ves que sí es, 
                // imprimiremos un log para debugear qué está viendo el bot.
                console.warn(`📢 [DEBUG-ADMIN] El bot ${botJid} dice no tener rango. Rango actual detectado: ${botParticipant?.admin || 'ninguno'}`);
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

        if (recentMsgs.length > 5 && iAmAdmin) {
            await sock.sendMessage(from, { delete: msg.key });
            return true;
        }
    }

    return false;
}

module.exports = { handleModeration };
