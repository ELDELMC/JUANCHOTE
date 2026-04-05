const { updateGroupSettings, getGroupSettings } = require('../utils/settings');
const { checkAdmin } = require('../utils/helpers');

module.exports = {
  command: ['react', 'reaccion', 'reacciones'],
  handler: async ({ sock, from, sender, args, isGroup, isMe }) => {
    try {
      const { isAuthorizedSender } = require('../utils/auth');
      
      // Verificar permisos: Admin, Bot o Dueño Autorizado
      let isAdmin = isMe || isAuthorizedSender(sender);
      
      if (isGroup && !isAdmin) {
        const metadata = await sock.groupMetadata(from);
        isAdmin = checkAdmin(metadata.participants, sender);
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
