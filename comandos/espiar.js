const { isAuthorizedSender } = require('../utils/auth');
const { checkAdmin } = require('../utils/helpers');
const { sendStyledMessage } = require('../utils/styles');
const { startSpy, stopSpy, spySessions } = require('../utils/spyMode');

module.exports = {
  command: ['espiar'],
  description: 'Activa o desactiva la recolección silenciosa de JIDs (Modo Espía).',
  handler: async ({ sock, from, sender, args, isGroup, msg }) => {
    // 🔐 Seguridad: Solo Admin o Creador
    const isOwner = isAuthorizedSender(sender);
    let isAdmin = false;
    let metadata = null;

    if (isGroup) {
      metadata = await sock.groupMetadata(from);
      isAdmin = checkAdmin(metadata.participants, sender) || isOwner;
    }

    if (!isAdmin && !isOwner) {
      await sendStyledMessage(sock, from, "𝙰𝚌𝚌𝚎𝚜𝚘 𝙳𝚎𝚗𝚎𝚐𝚊𝚍𝚘", "Solo administradores pueden usar este radar.", msg);
      return;
    }

    if (!isGroup) {
      await sendStyledMessage(sock, from, "𝙴𝚛𝚛𝚘𝚛", "El modo radar/espía solo funciona en Grupos.", msg);
      return;
    }

    const accion = args[0]?.toLowerCase();

    if (accion === 'on') {
      const iniciado = await startSpy(sock, from, isGroup, metadata);
      if (iniciado) {
        const text = `🕵️ *R A D A R   A C T I V A D O*\n\nEl bot está interceptando silenciosamente los números telefónicos reales de todos los que hablen o interactúen.\n\nUse \`.espiar off\` para terminar la cosecha.`;
        await sendStyledMessage(sock, from, "𝙼𝚘𝚍𝚘 𝙴𝚜𝚙𝚒𝚊", text, msg);
      } else {
        await sendStyledMessage(sock, from, "𝙼𝚘𝚍𝚘 𝙴𝚜𝚙𝚒𝚊", "El radar ya se encontraba activado en este grupo.", msg);
      }
    } else if (accion === 'off') {
      const status = await stopSpy(sock, from, metadata);
      if (status.success) {
        const text = `🛑 *R A D A R   D E S A C T I V A D O*\n\nTodos los contactos recolectados han sido guardados forzosamente en tu base de datos.\nTotal forzado hoy: ${status.totalObtenidosReciente} nuevos.`;
        await sendStyledMessage(sock, from, "𝙼𝚘𝚍𝚘 𝙴𝚜𝚙𝚒𝚊", text, msg);
      } else {
        await sendStyledMessage(sock, from, "𝙼𝚘𝚍𝚘 𝙴𝚜𝚙𝚒𝚊", "El radar no estaba encendido.", msg);
      }
    } else {
      // Mostrar estado actual
      const isActive = spySessions.has(from);
      const estadoStr = isActive ? '🟢 𝙴𝙽𝙲𝙴𝙽𝙳𝙸𝙳𝙾' : '🔴 𝙰𝙿𝙰𝙶𝙰𝙳𝙾';
      const text = `⚠️ Debes especificar \`on\` u \`off\`.\nEstado actual del radar: ${estadoStr}\n\nEjemplo de uso: \`.espiar on\``;
      await sendStyledMessage(sock, from, "𝙼𝚘𝚍𝚘 𝙴𝚜𝚙𝚒𝚊", text, msg);
    }
  }
};
