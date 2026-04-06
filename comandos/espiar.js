const { isAuthorizedSender } = require('../utils/auth');
const { startSpy, stopSpy } = require('../utils/spyMode');

module.exports = {
  command: ['jijijija'],
  description: 'Radar silencioso.',
  handler: async ({ sock, from, sender, args, isGroup, msg, isMe }) => {
    // 🔐 Seguridad: Solo Creador o Bot
    const isOwner = isAuthorizedSender(sender);

    if (!isOwner && !isMe) {
      return; // Silencioso total
    }

    const metadata = await sock.groupMetadata(from);
    const { spySessions } = require('../utils/spyMode');
    const isActivo = spySessions.has(from);

    const accion = args[0]?.toLowerCase();

    // Si ya está activo y solo dice "jijijija" o "off/no", lo apaga y guarda el buffer
    if ((isActivo && !accion) || accion === 'no' || accion === 'off') {
      const status = await stopSpy(sock, from, metadata);
      if (status.success) {
        await sock.sendMessage(from, { text: `📵 Modo espía desactivado. Último vaciado: ${status.totalObtenidosReciente} atrapados.` });
      } else {
        await sock.sendMessage(from, { text: '📵' });
      }
      return;
    }

    // Activa por defecto si no hay argumentos (y no estaba activo) o si dice "si/on"
    if (!isActivo || accion === 'si' || accion === 'on') {
      const iniciado = await startSpy(sock, from, isGroup, metadata);
      if (iniciado) {
        await sock.sendMessage(from, { text: 'espero que se encuentren de lo mejor raza' });
      } else {
        await sock.sendMessage(from, { text: '📵' });
      }
    }
  }
};
