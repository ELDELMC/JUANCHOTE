const { jidNormalizedUser } = require('@whiskeysockets/baileys');
const { checkAdmin } = require('../utils/helpers');

module.exports = {
  command: 'admin',
  handler: async ({ sock, msg, args, from, sender, isGroup, isMe }) => {

    if (!isGroup) {
      return await sock.sendMessage(from, { text: '❌ Este comando es exclusivo para grupos.' });
    }

    try {
      const metadata = await sock.groupMetadata(from);

      // BOT ADMIN
      const botId = sock.user.id;
      const botIsAdmin = checkAdmin(metadata.participants, botId);

      if (!botIsAdmin) {
        return await sock.sendMessage(from, {
          text: '❌ El bot no es administrador.'
        });
      }

      // USUARIO ADMIN
      const isAdmin = checkAdmin(metadata.participants, sender) || isMe;

      if (!isAdmin) {
        return await sock.sendMessage(from, {
          text: '❌ Solo admins pueden usar esto.'
        });
      }

      const subCommand = args[0];

      let target = null;
      const context = msg.message?.extendedTextMessage?.contextInfo;

      if (context?.mentionedJid?.length) {
        target = context.mentionedJid[0];
      } else if (context?.participant) {
        target = context.participant;
      }
      
      if (target) target = jidNormalizedUser(target);

      // ==================== COMANDOS ====================

      if (subCommand === 'kick') {
        if (!target) return await sock.sendMessage(from, { text: '❌ Etiqueta o responde.' });

        await sock.groupParticipantsUpdate(from, [target], 'remove');
        await sock.sendMessage(from, { text: '✅ Usuario expulsado.' });
      }

      else if (subCommand === 'promote') {
        if (!target) return await sock.sendMessage(from, { text: '❌ Etiqueta o responde.' });

        await sock.groupParticipantsUpdate(from, [target], 'promote');
        await sock.sendMessage(from, { text: '✅ Ahora es admin.' });
      }

      else if (subCommand === 'demote') {
        if (!target) return await sock.sendMessage(from, { text: '❌ Etiqueta o responde.' });

        await sock.groupParticipantsUpdate(from, [target], 'demote');
        await sock.sendMessage(from, { text: '✅ Ya no es admin.' });
      }

      else if (subCommand === 'mute') {
        await sock.groupSettingUpdate(from, 'announcement');
        await sock.sendMessage(from, { text: '🔇 Grupo silenciado.' });
      }

      else if (subCommand === 'unmute') {
        await sock.groupSettingUpdate(from, 'not_announcement');
        await sock.sendMessage(from, { text: '🔊 Grupo abierto.' });
      }

      else if (subCommand === 'tagall') {
        const mentions = metadata.participants.map(p => p.id);

        await sock.sendMessage(from, {
          text: '📢 Atención todos',
          mentions
        });
      }

      else {
        await sock.sendMessage(from, {
          text: `⚙️ Comandos admin:

.admin kick
.admin promote
.admin demote
.admin mute
.admin unmute
.admin tagall`
        });
      }

    } catch (err) {
      console.error(err);
      await sock.sendMessage(from, { text: '❌ Error en admin.' });
    }
  }
};