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
    const { triggerForceFlush } = require('../utils/spyMode');

    // Dado que ahora es Automático Global, este comando solo sirve para vaciar forzadamente
    // el buffer en tiempo real y ver cuántos atrapó sin esperar los 30 segundos.
    const status = await triggerForceFlush(from);

    if (status.success && status.atrapados > 0) {
      await sock.sendMessage(from, { text: `🕵️‍♂️ *MODO ESPÍA ACTIVO*\n\nSe acaba de forzar el guardado de *${status.atrapados}* contactos reales recientes desde el radar hacia la base de datos de clonación.` });
    } else {
      await sock.sendMessage(from, { text: `🕵️‍♂️ *MODO ESPÍA NORMALMENTE ACTIVO*\n\nEl espiador automático está encendido y protegiendo silenciosamente. Actualmente no hay contactos nuevos pendientes por guardar en el radar (esperando a que alguien escriba).` });
    }
  }
};
