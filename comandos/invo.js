/**
 * 📩 COMANDO .invo
 * Lista las bases de datos de grupos clonados y espera
 * que el usuario responda con el nombre exacto para iniciar
 * la agregación masiva.
 */

const { listarGruposClonados } = require('../utils/clonador');
const { pendingInvo, currentInvoProcess } = require('../utils/invocador');
const { checkAdmin } = require('../utils/helpers');

module.exports = {
  command: ['invo', 'invocar', 'agregar'],
  handler: async ({ sock, from, sender, args, isGroup, isMe }) => {
    // Solo grupos
    if (!isGroup) {
      return await sock.sendMessage(from, { text: '❌ Este comando es exclusivo para grupos.' });
    }

    // Verificar permisos
    try {
      const metadata = await sock.groupMetadata(from);
      const { isAuthorizedSender } = require('../utils/auth');
      
      // 1. Verificar si el EMISOR es admin o dueño
      const isAdminCheck = checkAdmin(metadata.participants, sender) || isMe || isAuthorizedSender(sender);
      if (!isAdminCheck) {
        return await sock.sendMessage(from, { text: '❌ Solo los administradores pueden usar este comando.' });
      }
    } catch (e) {
      return await sock.sendMessage(from, { text: '❌ Error al verificar permisos.' });
    }

    // Verificar que no haya proceso activo
    if (currentInvoProcess.has(from) && currentInvoProcess.get(from).active) {
      return await sock.sendMessage(from, { text: '⚠️ Ya hay un proceso de invitación activo.\nUsa *.stopinvo* para detenerlo primero.' });
    }

    // Listar bases de datos disponibles
    const grupos = await listarGruposClonados();

    if (grupos.length === 0) {
      return await sock.sendMessage(from, { 
        text: '❌ No hay bases de datos disponibles.\n\n_Ve a un grupo origen y envía *_hola* para clonar sus miembros primero._'
      });
    }

    // Construir el menú con lista numerada
    let lista = '🤖 *¿Desde qué base de datos quieres agregar miembros?*\n\n';
    lista += '📂 *Grupos clonados disponibles:*\n';
    grupos.forEach((g, i) => {
      lista += `  ${i + 1}. \`${g}\`\n`;
    });
    lista += '\n_Responde con el *nombre exacto* del grupo._\n';
    lista += `_Ejemplo: \`${grupos[0]}\`_`;

    await sock.sendMessage(from, { text: lista });

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
