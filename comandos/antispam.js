const { updateGroupSettings, getGroupSettings } = require('../utils/settings');
const { checkAdmin } = require('../utils/helpers');

module.exports = {
  command: ['antispam', 'bloquearspam'],
  handler: async ({ sock, from, sender, args, isGroup }) => {
    if (!isGroup) return await sock.sendMessage(from, { text: '❌ Este comando es exclusivo para grupos.' });

    try {
      const metadata = await sock.groupMetadata(from);
      const isAdmin = checkAdmin(metadata.participants, sender);
      if (!isAdmin) return await sock.sendMessage(from, { text: '❌ Solo admins.' });

      const action = (args[0] || '').toLowerCase();

      if (action === 'on' || action === 'activar') {
        updateGroupSettings(from, { antispam: true });
        await sock.sendMessage(from, { text: '🚫 *Antispam ACTIVADO* 🔒\nMáximo 5 mensajes por minuto.' });
      } else if (action === 'off' || action === 'desactivar') {
        updateGroupSettings(from, { antispam: false });
        await sock.sendMessage(from, { text: '🔓 *Antispam DESACTIVADO*' });
      } else {
        const settings = getGroupSettings(from);
        await sock.sendMessage(from, { text: `🛡️ *Estatus Antispam:* ${settings.antispam ? '✅ ON' : '⚪ OFF'}\nUsa: !antispam on/off` });
      }
    } catch (e) {
      console.error(e);
      await sock.sendMessage(from, { text: '❌ Error al actualizar antispam.' });
    }
  }
};
