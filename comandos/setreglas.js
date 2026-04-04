const { updateGroupSettings } = require('../utils/settings');
const { checkAdmin } = require('../utils/helpers');

module.exports = {
  command: ['setreglas', 'setrules'],
  handler: async ({ sock, msg, from, sender, args, isGroup, isMe }) => {
    if (!isGroup) return await sock.sendMessage(from, { text: '❌ Este comando es exclusivo para grupos.' });

    try {
      const metadata = await sock.groupMetadata(from);
      const isAdmin = checkAdmin(metadata.participants, sender) || isMe;
      if (!isAdmin) return await sock.sendMessage(from, { text: '❌ Solo admins.' });

      const text = args.join(' ');
      if (!text) return await sock.sendMessage(from, { text: '❌ Uso: !setreglas 1. No spam, 2. No insultos...' });

      updateGroupSettings(from, { reglas: text });
      await sock.sendMessage(from, { text: '✅ Normas actualizadas con éxito.' });
    } catch (e) {
      console.error(e);
      await sock.sendMessage(from, { text: '❌ Error al guardar reglas.' });
    }
  }
};
