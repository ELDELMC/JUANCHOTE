/**
 * 🔄 COMANDO OCULTO: .reloadperms
 * Recarga el archivo allowed_users.json en tiempo real.
 * Solo puede ser ejecutado por usuarios autorizados.
 */

const { recargarPermisos, isAuthorizedSender } = require('../utils/auth');

module.exports = {
  command: ['reloadperms', 'recargarperm'],
  handler: async ({ sock, from, sender }) => {
    // Solo usuarios autorizados pueden recargar permisos
    if (!isAuthorizedSender(sender)) {
      console.log(`🚨 [AUTH] Intento NO autorizado de recargar permisos: ${sender}`);
      return await sock.sendMessage(from, { text: '⛔ No tienes permiso para esto.' });
    }

    try {
      const total = await recargarPermisos();
      console.log(`🔄 [AUTH] Permisos recargados por ${sender}. Total: ${total}`);
      await sock.sendMessage(from, { text: `✅ Permisos recargados.\n🔐 Usuarios autorizados: *${total}*` });
    } catch (err) {
      console.error('❌ [AUTH] Error recargando permisos:', err);
      await sock.sendMessage(from, { text: '❌ Error al recargar permisos.' });
    }
  }
};
