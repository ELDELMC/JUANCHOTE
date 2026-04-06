/**
 * 📩 COMANDO .invo
 * Lista las bases de datos de grupos clonados y espera
 * que el usuario responda con el nombre exacto para iniciar
 * la agregación masiva.
 */

const { listarGruposClonados } = require('../utils/clonador');
const { pendingInvo, currentInvoProcess } = require('../utils/invocador');
const { checkAdmin } = require('../utils/helpers');
const { sendStyledMessage } = require('../utils/styles');

module.exports = {
  command: ['invo', 'invocar', 'agregar'],
  handler: async ({ sock, from, sender, args, isGroup, isMe }) => {
    // Solo grupos
    if (!isGroup) {
      return await sendStyledMessage(sock, from, "𝙴𝚛𝚛𝚘𝚛", "Este comando es exclusivo para grupos.");
    }

    // Verificar permisos
    try {
      const { isAuthorizedSender } = require('../utils/auth');
      
      const isAdminCheck = isMe || isAuthorizedSender(sender);
      if (!isAdminCheck) {
        return; // Silencioso
      }
    } catch (e) {
      return;
    }

    // Verificar que no haya proceso activo
    if (currentInvoProcess.has(from) && currentInvoProcess.get(from).active) {
      return await sendStyledMessage(sock, from, "𝙿𝚛𝚘𝚌𝚎𝚜𝚘 𝙰𝚌𝚝𝚒𝚟𝚘", "Ya hay un proceso de invitación activo.\nUsa `.stopinvo` para detenerlo primero.");
    }

    // Listar bases de datos disponibles
    const grupos = await listarGruposClonados();

    if (grupos.length === 0) {
      return await sendStyledMessage(sock, from, "𝚂𝚒𝚗 𝙱𝚊𝚜𝚎𝚜 𝚍𝚎 𝙳𝚊𝚝𝚘𝚜", "No hay grupos clonados disponibles.\n\nVe a un grupo origen y envía *_hola* para clonar sus miembros primero.");
    }

    // Construir el menú con lista numerada
    // Construir el menú con lista numerada
    let lista = '¿Desde qué base de datos quieres agregar miembros?\n\n';
    lista += 'Grupos clonados disponibles:\n';
    grupos.forEach((g, i) => {
      lista += `${i + 1}. ${g}\n`;
    });
    lista += '\nResponde con el NÚMERO de tu opción.\n';
    lista += 'Ejemplo: 1';

    await sendStyledMessage(sock, from, "𝚂𝚎𝚕𝚎𝚌𝚌𝚒𝚘𝚗𝚊𝚛 𝙱𝙳", lista);

    // Guardar estado: esperando respuesta de este usuario en este grupo
    pendingInvo.set(from, {
      sender,
      timestamp: Date.now(),
      stage: 'waiting_db_name',
      availableGroups: grupos
    });

    console.log(`📩 [INVO] Esperando selección de BD de ${sender} en ${from}`);

    // Auto-limpiar si no responde en 5 minutos
    setTimeout(() => {
      const pending = pendingInvo.get(from);
      if (pending && pending.sender === sender && pending.stage === 'waiting_db_name') {
        pendingInvo.delete(from);
        console.log(`⏰ [INVO] Timeout: Limpiando estado pendiente en ${from}`);
      }
    }, 300000); // 5 minutos
  }
};
