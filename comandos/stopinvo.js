/**
 * 🛑 COMANDO .stopinvo
 * Detiene cualquier proceso de invitación masiva activo en el grupo.
 */

const { detenerAgregacion, currentInvoProcess } = require('../utils/invocador');
const { checkAdmin } = require('../utils/helpers');

module.exports = {
  command: ['stopinvo', 'pararinvo', 'stopinvocacion'],
  handler: async ({ sock, from, sender, isGroup, isMe }) => {
    if (!isGroup) {
      return await sock.sendMessage(from, { text: '❌ Este comando es exclusivo para grupos.' });
    }

    try {
      const metadata = await sock.groupMetadata(from);
      if (!checkAdmin(metadata.participants, sender) && !isMe) {
        return await sock.sendMessage(from, { text: '❌ Solo admins.' });
      }
    } catch (e) {
      return await sock.sendMessage(from, { text: '❌ Error de permisos.' });
    }

    if (!currentInvoProcess.has(from) || !currentInvoProcess.get(from).active) {
      return await sock.sendMessage(from, { text: '⚪ No hay ningún proceso de invitación activo en este grupo.' });
    }

    const stopped = detenerAgregacion(from);
    if (stopped) {
      console.log(`🛑 [STOPINVO] Proceso detenido por ${sender} en ${from}`);
      // El mensaje de confirmación lo envía el propio bucle del invocador al detectar el flag
    } else {
      await sock.sendMessage(from, { text: '⚠️ No se pudo detener el proceso.' });
    }
  }
};
