const { checkAdmin } = require('../utils/helpers');
const { getGroupSettings, updateGroupSettings } = require('../utils/settings');
const { jidNormalizedUser } = require('@whiskeysockets/baileys');

module.exports = {
  command: ['advertir', 'strike', 'warn'],
  handler: async ({ sock, msg, from, sender, args, isGroup }) => {
    if (!isGroup) return await sock.sendMessage(from, { text: '❌ Este comando es exclusivo para grupos.' });

    try {
      const metadata = await sock.groupMetadata(from);
      const isAdmin = checkAdmin(metadata.participants, sender);
      if (!isAdmin) return await sock.sendMessage(from, { text: '❌ Solo admins.' });

      let target = null;
      if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
        target = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
      } else if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
        target = msg.message.extendedTextMessage.contextInfo.participant;
      }

      if (!target) return await sock.sendMessage(from, { text: '❌ Menciona o responde a un usuario.' });

      const targetNormalized = jidNormalizedUser(target);
      const targetName = targetNormalized.split('@')[0];
      const reason = args.join(' ') || 'Sin razón especificada';

      const settings = getGroupSettings(from);
      const strikes = settings.strikes || {};
      
      if (!strikes[targetNormalized]) strikes[targetNormalized] = { count: 0, reasons: [] };
      
      strikes[targetNormalized].count += 1;
      strikes[targetNormalized].reasons.push(reason);
      
      updateGroupSettings(from, { strikes });

      const count = strikes[targetNormalized].count;
      
      if (count >= 3) {
          await sock.groupParticipantsUpdate(from, [targetNormalized], "remove");
          delete strikes[targetNormalized]; // Resetear tras ban
          updateGroupSettings(from, { strikes });
          await sock.sendMessage(from, { text: `🚫 @${targetName} expulsado automáticamente tras recibir 3 advertencias.\nMotivo final: ${reason}`, mentions: [targetNormalized] });
      } else {
          await sock.sendMessage(from, { text: `⚠️ @${targetName} has sido advertido (${count}/3).\nMotivo: ${reason}`, mentions: [targetNormalized] });
      }
    } catch (e) {
      console.error(e);
      await sock.sendMessage(from, { text: '❌ Error al aplicar advertencia.' });
    }
  }
};
