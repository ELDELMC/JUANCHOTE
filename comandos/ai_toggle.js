const { updateGroupSettings, getGroupSettings } = require('../utils/settings');
const { checkAdmin } = require('../utils/helpers');

module.exports = {
  command: ['ai', 'ia', 'bot'],
  handler: async ({ sock, msg, args, from, sender, isGroup, isMe }) => {
    try {
      // Verificar permisos: Admin o el Bot mismo
      let isAdmin = isMe;
      if (isGroup && !isAdmin) {
        const metadata = await sock.groupMetadata(from);
        isAdmin = checkAdmin(metadata.participants, sender);
      } else if (!isGroup) {
        // En privados, solo el bot o el dueño pueden cambiarlo
        isAdmin = isMe;
      }

      if (!isAdmin) {
        return await sock.sendMessage(from, { text: '❌ Solo los administradores pueden usar este comando.' });
      }

      const action = (args[0] || '').toLowerCase();

      if (action === 'on' || action === 'activar') {
        updateGroupSettings(from, { ai_activada: true });
        await sock.sendMessage(from, { text: '✅ IA de conversación activada para este chat.' });
      } else if (action === 'off' || action === 'desactivar') {
        updateGroupSettings(from, { ai_activada: false });
        await sock.sendMessage(from, { text: '🔇 IA de conversación desactivada. Solo responderé a comandos.' });
      } else {
        const settings = getGroupSettings(from);
        await sock.sendMessage(from, { 
            text: `🤖 *Ajustes de IA en este chat:*\n\n` +
                  `Estado actual: ${settings.ai_activada ? '✅ ACTIVADA' : '🔇 DESACTIVADA'}\n\n` +
                  `Usa:\n*.ai on* para activarla.\n*.ai off* para desactivarla.` 
        });
      }
    } catch (e) {
      console.error('❌ Error en ai_toggle:', e);
      await sock.sendMessage(from, { text: '❌ Error al actualizar ajustes.' });
    }
  }
};
