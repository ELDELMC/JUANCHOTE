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

            const senderIsAdmin = checkAdmin(metadata.participants, sender) || isMe || isAuthorizedSender(sender);
            if (!senderIsAdmin) {
                return await sock.sendMessage(from, { text: '❌ Solo los administradores pueden usar este comando.' });
            }

            let target = msg.message?.extendedTextMessage?.contextInfo?.participant;
            if (!target && msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
                target = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
            }
            
            if (target) target = jidNormalizedUser(target);

            if (!target) {
                return await sock.sendMessage(from, { text: '❌ Debes responder a un mensaje o etiquetar a alguien para silenciarlo.' });
            }

            let durationArg = args.find(a => a.match(/^\d+[smhdMa]$/));
            
            if (!durationArg) {
                return await sock.sendMessage(from, { 
                    text: '⚠️ ¿Por cuánto tiempo?\n\nEjemplos:\n.mute 10m\n.mute 1h\n.mute 1d' 
                });
            }

            const expiration = parseDuration(durationArg);
            if (!expiration) {
                return await sock.sendMessage(from, { text: '❌ Formato inválido.' });
            }

            muteUser(from, target, expiration);

            // Mapeo limpio para evitar el bug de "dí añoss"
            const mapUnits = { s: 'segundos', m: 'minutos', h: 'horas', d: 'días', M: 'meses', a: 'años' };
            const unit = durationArg.slice(-1);
            const value = durationArg.slice(0, -1);
            const timeReadable = `${value} ${mapUnits[unit]}`;

            await sock.sendMessage(from, { 
                text: `🔇 @${target.split('@')[0]} ha sido silenciado por *${timeReadable}*.\n\nSus mensajes serán eliminados automáticamente.`,
                mentions: [target]
            });

        } catch (e) {
            console.error("Error en comando mute:", e);
        }
    }
};
