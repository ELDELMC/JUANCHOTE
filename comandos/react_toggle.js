const { updateGroupSettings, getGroupSettings } = require('../utils/settings');
const { checkAdmin } = require('../utils/helpers');

module.exports = {
  command: ['react', 'reaccion', 'reacciones'],
  handler: async ({ sock, from, sender, args, isGroup, isMe }) => {
    try {
      // Verificar permisos: Admin o el Bot mismo
      let isAdmin = isMe;
      if (isGroup && !isAdmin) {
        const metadata = await sock.groupMetadata(from);
        isAdmin = checkAdmin(metadata.participants, sender);
      } else if (!isGroup) {
        // En privados, solo el bot o el dueño pueden cambiarlo (isMe ya cubre al bot)
        // Por ahora permitimos que cualquiera lo cambie en SU propio privado si quiere,
        // pero lo ideal es que sea el bot/dueño.
        isAdmin = isMe; 
      }

      if (!isAdmin) {
        return await sock.sendMessage(from, { text: '❌ Solo los administradores pueden cambiar este ajuste.' });
      }

      const action = (args[0] || '').toLowerCase();

      if (action === 'on' || action === 'activar') {
        updateGroupSettings(from, { react_activada: true });
        await sock.sendMessage(from, { text: '✅ Auto-reacciones activadas para este chat.' });
      } else if (action === 'off' || action === 'desactivar') {
        updateGroupSettings(from, { react_activada: false });
        await sock.sendMessage(from, { text: '🔇 Auto-reacciones desactivadas para este chat.' });
      } else {
        const settings = getGroupSettings(from);
        await sock.sendMessage(from, { 
            text: `🎭 *Ajustes de Reacciones en este chat:*\n\n` +
                  `Estado actual: ${settings.react_activada ? '✅ ACTIVADA' : '🔇 DESACTIVADA'}\n\n` +
                  `Usa:\n*.react on* para activarlas.\n*.react off* para desactivarlas.` 
        });
      }
    } catch (e) {
      console.error('❌ Error en react_toggle:', e);
      await sock.sendMessage(from, { text: '❌ Error al actualizar ajustes de reacción.' });
    }
  }
};
