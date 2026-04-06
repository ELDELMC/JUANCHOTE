const { jidNormalizedUser } = require('@whiskeysockets/baileys');
const { unmuteUser } = require('../utils/mute');
const { checkAdmin } = require('../utils/helpers');

module.exports = {
    command: ['unmute', 'desilenciar', 'desilencio', 'habla'],
    handler: async ({ sock, msg, from, sender, isGroup, isMe }) => {
        if (!isGroup) return;

        try {
            const metadata = await sock.groupMetadata(from);
            const { isAuthorizedSender } = require('../utils/auth');

            // Solo admins pueden quitar el silencio
            const senderIsAdmin = checkAdmin(metadata.participants, sender) || isMe || isAuthorizedSender(sender);
            if (!senderIsAdmin) {
                return await sock.sendMessage(from, { text: '❌ No tienes permisos para quitar silencios.' });
            }

            let target = msg.message?.extendedTextMessage?.contextInfo?.participant;
            if (!target && msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
                target = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
            }
            
            if (target) target = jidNormalizedUser(target);

            if (!target) {
                return await sock.sendMessage(from, { text: '❌ Responde al mensaje de alguien o etiquétalo para quitarle el silencio.' });
            }

            unmuteUser(from, target);

            await sock.sendMessage(from, { 
                text: `🔊 @${target.split('@')[0]} ya puede volver a hablar.\n\nEscudo desactivado para este usuario.`,
                mentions: [target]
            });

        } catch (e) {
            console.error("Error en comando unmute:", e);
        }
    }
};
