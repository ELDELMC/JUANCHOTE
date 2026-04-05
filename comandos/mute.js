const { jidNormalizedUser } = require('@whiskeysockets/baileys');
const { parseDuration, muteUser } = require('../utils/mute');
const { checkAdmin } = require('../utils/helpers');

module.exports = {
    command: ['mute', 'silencio', 'silenciar'],
    handler: async ({ sock, msg, args, from, sender, isGroup, isMe }) => {
        if (!isGroup) {
            return await sock.sendMessage(from, { text: '❌ Este comando es exclusivo para grupos.' });
        }

        try {
            const metadata = await sock.groupMetadata(from);
            const { isAuthorizedSender } = require('../utils/auth');

            // 1. Verificar si el EMISOR es admin o dueño
            const senderIsAdmin = checkAdmin(metadata.participants, sender) || isMe || isAuthorizedSender(sender);
            if (!senderIsAdmin) {
                return await sock.sendMessage(from, { text: '❌ Solo los administradores pueden usar este comando.' });
            }

            // Obtener objetivo (respuesta o mención)
            let target = msg.message?.extendedTextMessage?.contextInfo?.participant;
            if (!target && msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
                target = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
            }
            
            if (target) target = jidNormalizedUser(target);

            if (!target) {
                return await sock.sendMessage(from, { text: '❌ Debes responder a un mensaje o etiquetar a alguien para silenciarlo.' });
            }

            // Obtener duración (ej: .mute + 1h o .mute 1h)
            let durationArg = args.find(a => a.match(/^\+?\d+[smhdMa]$/));
            
            if (!durationArg) {
                return await sock.sendMessage(from, { 
                    text: '⚠️ ¿Por cuánto tiempo deseas silenciar al miembro?\n\nEjemplos:\n.mute 1s (segundos)\n.mute 1m (minutos)\n.mute 1h (horas)\n.mute 1d (días)\n.mute 1M (meses)\n.mute 1a (años)\n\nUsa el comando de nuevo con el tiempo deseado.' 
                });
            }

            // Normalizar (quitar el '+' si existe)
            const cleanDuration = durationArg.replace('+', '');
            const expiration = parseDuration(cleanDuration);

            if (!expiration) {
                return await sock.sendMessage(from, { text: '❌ Formato de tiempo inválido. Usa: 1s, 1m, 1h, 1d, 1M, 1a.' });
            }

            muteUser(from, target, expiration);

            const timeReadable = cleanDuration
                .replace('s', ' segundos')
                .replace('m', ' minutos')
                .replace('h', ' horas')
                .replace('d', ' días')
                .replace('M', ' meses')
                .replace('a', ' años');

            await sock.sendMessage(from, { 
                text: `🔇 @${target.split('@')[0]} ha sido silenciado por ${timeReadable}.\n\nSus mensajes serán eliminados automáticamente hasta que pase el tiempo.`,
                mentions: [target]
            });

        } catch (e) {
            console.error("Error en comando mute:", e);
            await sock.sendMessage(from, { text: '❌ Ocurrió un error al intentar silenciar al miembro.' });
        }
    }
};
