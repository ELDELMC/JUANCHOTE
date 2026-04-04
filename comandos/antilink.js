const { updateGroupSettings, getGroupSettings } = require('../utils/settings');
const { checkAdmin } = require('../utils/helpers');

module.exports = {
  command: ['antilink', 'bloquearlink'],
  handler: async ({ sock, from, sender, args, isGroup, isMe }) => {
    if (!isGroup) return await sock.sendMessage(from, { text: '❌ Este comando es exclusivo para grupos.' });

    try {
      const metadata = await sock.groupMetadata(from);
      const isAdmin = checkAdmin(metadata.participants, sender) || isMe;
      if (!isAdmin) return await sock.sendMessage(from, { text: '❌ Solo admins.' });

      const action = (args[0] || '').toLowerCase();

      if (action === 'on' || action === 'activar') {
        updateGroupSettings(from, { antilink: true });
        await sock.sendMessage(from, { text: '🚫 *Antilink ACTIVADO* 🔒\nCualquier enlace de terceros será borrado automáticamente.' });
      } else if (action === 'off' || action === 'desactivar') {
        updateGroupSettings(from, { antilink: false });
        await sock.sendMessage(from, { text: '🔓 *Antilink DESACTIVADO*' });
      } else {
        const settings = getGroupSettings(from);
        await sock.sendMessage(from, { text: `🛡️ *Estatus Antilink:* ${settings.antilink ? '✅ ON' : '⚪ OFF'}\nUsa: !antilink on/off` });
      }
    } catch (e) {
      console.error(e);
      await sock.sendMessage(from, { text: '❌ Error al actualizar antilink.' });
    }
  }
};
