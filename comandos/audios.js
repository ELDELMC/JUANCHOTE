const { updateGroupSettings, getGroupSettings } = require('../utils/settings');

module.exports = {
  command: ['audios'],
  handler: async ({ sock, msg, args, from, sender, isGroup }) => {
    if (!isGroup(from)) {
      return await sock.sendMessage(from, { text: '❌ Este comando es exclusivo para grupos.' });
    }

    try {
      const metadata = await sock.groupMetadata(from);
      
      // USUARIO ADMIN
      const isAdmin = metadata.participants.some(p => p.id === sender && p.admin);

      if (!isAdmin) {
        return await sock.sendMessage(from, { text: '❌ Solo los administradores pueden usar esto.' });
      }

      const action = args[0]?.toLowerCase();

      if (action === 'on') {
        updateGroupSettings(from, { audios_activados: true });
        await sock.sendMessage(from, { text: '✅ Audios ACTIVADOS. JUANCHOTE transcribirá y responderá audios (si le hablan a él).' });
      } else if (action === 'off') {
        updateGroupSettings(from, { audios_activados: false });
        await sock.sendMessage(from, { text: '🚫 Audios DESACTIVADOS. JUANCHOTE ignorará todos los audios.' });
      } else {
        const current = getGroupSettings(from).audios_activados ? 'ENCENDIDOS ✅' : 'APAGADOS 🚫';
        await sock.sendMessage(from, { text: `🎙️ Estado actual: ${current}\n\nUsa .audios on | .audios off para cambiarlo.` });
      }

    } catch (err) {
      console.error(err);
      await sock.sendMessage(from, { text: '❌ Error al modificar configuración de audios.' });
    }
  }
};
