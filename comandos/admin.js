const { jidNormalizedUser } = require('@whiskeysockets/baileys');
const { checkAdmin } = require('../utils/helpers');
const { isAuthorizedSender } = require('../utils/auth');

module.exports = {
  command: 'admin',
  handler: async ({ sock, msg, args, from, sender, isGroup, isMe }) => {

    if (!isGroup) {
      return await sock.sendMessage(from, { text: '❌ Este comando es exclusivo para grupos.' });
    }

    try {
      const metadata = await sock.groupMetadata(from);

      // 1. Verificar si el EMISOR es admin o dueño
      const isAdmin = checkAdmin(metadata.participants, sender) || isMe || isAuthorizedSender(sender);
      if (!isAdmin) {
        return await sock.sendMessage(from, {
          text: '❌ Solo los administradores pueden usar este comando.'
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
        if (!target) return await sock.sendMessage(from, { text: '❌ Etiqueta o responde a alguien.' });
        await sock.groupParticipantsUpdate(from, [target], 'remove');
        await sock.sendMessage(from, { text: '✅ Usuario expulsado.' });
      }

      else if (subCommand === 'promote') {
        if (!target) return await sock.sendMessage(from, { text: '❌ Etiqueta o responde a alguien.' });
        await sock.groupParticipantsUpdate(from, [target], 'promote');
        await sock.sendMessage(from, { text: '✅ Ahora es admin.' });
      }

      else if (subCommand === 'demote') {
        if (!target) return await sock.sendMessage(from, { text: '❌ Etiqueta o responde a alguien.' });
        await sock.groupParticipantsUpdate(from, [target], 'demote');
        await sock.sendMessage(from, { text: '✅ Ya no es admin.' });
      }

      else if (subCommand === 'mute') {
        await sock.groupSettingUpdate(from, 'announcement');
        await sock.sendMessage(from, { text: '🔇 Grupo silenciado (solo admins envían mensajes).' });
      }

      else if (subCommand === 'unmute') {
        await sock.groupSettingUpdate(from, 'not_announcement');
        await sock.sendMessage(from, { text: '🔊 Grupo abierto (todos envían mensajes).' });
      }

      else if (subCommand === 'tagall') {
        const mentions = metadata.participants.map(p => p.id);
        await sock.sendMessage(from, {
          text: '📢 *¡Atención a todos los miembros!*',
          mentions
        });
      }

      else {
        await sock.sendMessage(from, {
          text: `⚙️ *Comandos de Administración:*
\n.admin kick (expulsar)
.admin promote (dar admin)
.admin demote (quitar admin)
.admin mute (cerrar grupo)
.admin unmute (abrir grupo)
.admin tagall (mencionar a todos)`
        });
      }

    } catch (err) {
      console.error('Error en admin:', err);
      await sock.sendMessage(from, { text: '❌ Ocurrió un error al ejecutar la acción de administrador.' });
    }
  }
};