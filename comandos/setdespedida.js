const { updateGroupSettings } = require('../utils/settings');
const { checkAdmin } = require('../utils/helpers');

module.exports = {
  command: ['setdespedida', 'setgoodbye'],
  handler: async ({ sock, msg, from, sender, args, isGroup, isMe }) => {
    if (!isGroup) return await sock.sendMessage(from, { text: '❌ Este comando es exclusivo para grupos.' });

    try {
      const metadata = await sock.groupMetadata(from);
      const { isAuthorizedSender } = require('../utils/auth');
      const isAdmin = checkAdmin(metadata.participants, sender) || isMe || isAuthorizedSender(sender);
      if (!isAdmin) return await sock.sendMessage(from, { text: '❌ Solo admins.' });

      const text = args.join(' ');
      if (!text) return await sock.sendMessage(from, { text: '❌ Uso: !setdespedida Hasta luego @user, @groupname te extrañará.' });

      updateGroupSettings(from, { despedida: text });
      await sock.sendMessage(from, { text: '✅ Mensaje de despedida guardado.' });
    } catch (e) {
      console.error(e);
      await sock.sendMessage(from, { text: '❌ Error al guardar despedida.' });
    }
  }
};
