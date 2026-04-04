const { checkAdmin } = require('../utils/helpers');
const { jidNormalizedUser } = require('@whiskeysockets/baileys');

module.exports = {
  command: ['expulsar', 'kick', 'sacar', 'ban'],
  handler: async ({ sock, msg, from, sender, isGroup, isMe }) => {
    if (!isGroup) return await sock.sendMessage(from, { text: '❌ Este comando es exclusivo para grupos.' });

    try {
      const metadata = await sock.groupMetadata(from);
      const isAdmin = checkAdmin(metadata.participants, sender) || isMe;
      if (!isAdmin) return await sock.sendMessage(from, { text: '❌ Solo admins.' });

      let target = null;
      if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
        target = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
      } else if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
        target = msg.message.extendedTextMessage.contextInfo.participant;
      }

      if (!target) return await sock.sendMessage(from, { text: '❌ Menciona o responde a un usuario para expulsarlo.' });
      
      const targetNormalized = jidNormalizedUser(target);
      if (checkAdmin(metadata.participants, targetNormalized)) {
          return await sock.sendMessage(from, { text: '❌ No puedo expulsar a un administrador.' });
      }

      await sock.groupParticipantsUpdate(from, [targetNormalized], "remove");
      await sock.sendMessage(from, { text: `✅ Se ha expulsado a @${targetNormalized.split('@')[0]}`, mentions: [targetNormalized] });
    } catch (e) {
      console.error(e);
      await sock.sendMessage(from, { text: '❌ Error: ¿Soy admin?' });
    }
  }
};
