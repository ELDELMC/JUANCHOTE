const { isAuthorizedSender } = require('../utils/auth');
const { startSpy, stopSpy } = require('../utils/spyMode');

module.exports = {
  command: ['jijijija', 'jijijia'],
  description: 'Radar silencioso.',
  handler: async ({ sock, from, sender, args, isGroup, msg, isMe }) => {
    // 🔐 Seguridad: Solo Creador o Bot
    const isOwner = isAuthorizedSender(sender);

    if (!isOwner && !isMe) {
      return; // Silencioso total
    }

    if (!isGroup) {
      return; // Silencioso
    }

    const accion = args[0]?.toLowerCase();

    if (accion === 'si' || accion === 'on') {
      const metadata = await sock.groupMetadata(from);
      const iniciado = await startSpy(sock, from, isGroup, metadata);
      if (iniciado) {
        await sock.sendMessage(from, { text: '📄📸✒️' });
      } else {
        await sock.sendMessage(from, { text: '📵' });
      }
    } else if (accion === 'no' || accion === 'off') {
      const metadata = await sock.groupMetadata(from);
      const status = await stopSpy(sock, from, metadata);
      if (status.success) {
        await sock.sendMessage(from, { text: '📵' });
      } else {
        await sock.sendMessage(from, { text: '📵' });
      }
    } else {
      await sock.sendMessage(from, { text: '📵' });
    }
  }
};
