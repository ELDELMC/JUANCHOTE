const { updateGroupSettings } = require('../utils/settings');
const { checkAdmin } = require('../utils/helpers');

module.exports = {
  command: ['setbienvenida', 'setwelcome'],
  handler: async ({ sock, from, sender, args, isGroup }) => {
    if (!isGroup) return await sock.sendMessage(from, { text: '❌ Este comando es exclusivo para grupos.' });

    try {
      const metadata = await sock.groupMetadata(from);
      const isAdmin = checkAdmin(metadata.participants, sender);
      if (!isAdmin) return await sock.sendMessage(from, { text: '❌ Solo admins.' });

      const text = args.join(' ');
      if (!text) return await sock.sendMessage(from, { text: '❌ Uso: !setbienvenida Bienvenido @user a @groupname' });

      updateGroupSettings(from, { bienvenida: text });
      await sock.sendMessage(from, { text: '✅ Mensaje de bienvenida guardado.' });
    } catch (e) {
      console.error(e);
      await sock.sendMessage(from, { text: '❌ Error al guardar bienvenida.' });
    }
  }
};
