const { iniciarCuenta, finalizarCuenta, obtenerSesion } = require('../utils/accounts');
const { getIsAdmin } = require('../utils/helpers');
const { isAuthorizedSender } = require('../utils/auth');

module.exports = {
  command: ['cuenta', 'contabilidad'],
  handler: async ({ sock, msg, args, from, sender, isGroup, isMe }) => {
    const action = (args[0] || '').toLowerCase();
    const sesionActiva = obtenerSesion(from);

    if (action === 'on' || action === 'activar' || action === 'iniciar') {
      let isAdminUser = true;
      if (isGroup) {
        isAdminUser = await getIsAdmin(sock, from, sender) || isAuthorizedSender(sender) || isMe;
      }

      if (!isAdminUser) {
        return await sock.sendMessage(from, { text: '⛔ Solo los administradores pueden activar el modo cuenta.' });
      }

      if (sesionActiva) {
        return await sock.sendMessage(from, { text: '⚠️ Ya hay una sesión de cuenta activa en este chat.' });
      }
      iniciarCuenta(from);
      await sock.sendMessage(from, { text: '📥 *¡Modo Cuenta Activado manualmente!* 🧮\n\nPuedes enviarme los montos ahora. Usa *.cuenta off* para cerrarla y ver el reporte.' });
    } else if (action === 'off' || action === 'desactivar' || action === 'terminar') {
      if (!sesionActiva) {
        return await sock.sendMessage(from, { text: '❌ No hay ninguna sesión de cuenta activa para cerrar.' });
      }
      
      const resultado = finalizarCuenta(from);
      const total = resultado.total;
      
      const porc25 = total * 0.25;
      const queda25 = total - porc25;
      
      const porc30 = total * 0.30;
      const queda30 = total - porc30;

      const f = (num) => new Intl.NumberFormat('es-CO').format(num);

      const reporte = `📊 *REPORTE DE CUENTA FINAL* 📊\n\n` +
                      `💰 *Total acumulado:* $${f(total)}\n` +
                      `━━━━━━━━━━━━━━━\n\n` +
                      `🔹 *OPCIÓN 25%*\n` +
                      `▫️ Porcentaje: $${f(porc25)}\n` +
                      `🏠 *Fundación queda con:* $${f(queda25)}\n\n` +
                      `🔸 *OPCIÓN 30%*\n` +
                      `▫️ Porcentaje: $${f(porc30)}\n` +
                      `🏠 *Fundación queda con:* $${f(queda30)}\n\n` +
                      `✅ *Cuenta cerrada con éxito.*`;

      await sock.sendMessage(from, { text: reporte });
    } else {
      await sock.sendMessage(from, { 
        text: `🧮 *Gestión de Cuentas:*\n\n` +
              `Estado: ${sesionActiva ? '✅ ACTIVA' : '⚪ INACTIVA'}\n\n` +
              `Usa:\n*.cuenta on* - Iniciar manualmente.\n*.cuenta off* - Finalizar y ver reporte.` 
      });
    }
  }
};
