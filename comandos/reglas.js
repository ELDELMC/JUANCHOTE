const { getGroupSettings, updateGroupSettings } = require('../utils/settings');
const { checkAdmin } = require('../utils/helpers');

module.exports = {
  command: ['reglas', 'rules'],
  handler: async ({ sock, from, sender, isGroup }) => {
    if (!isGroup) return await sock.sendMessage(from, { text: '❌ Este comando es exclusivo para grupos.' });

    try {
      const settings = getGroupSettings(from);
      if (!settings.reglas) {
          return await sock.sendMessage(from, { text: '⚪ No hay reglas configuradas para este grupo.' });
      }
      
      const metadata = await sock.groupMetadata(from);
      const text = `📜 *NORMAS DE ${metadata.subject}* 📜\n\n${settings.reglas}`;
      await sock.sendMessage(from, { text });
    } catch (e) {
      console.error(e);
      await sock.sendMessage(from, { text: '❌ Error al obtener reglas.' });
    }
  }
};
