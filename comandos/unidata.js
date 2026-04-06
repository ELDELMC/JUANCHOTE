/**
 * 🔗 COMANDO .unidata
 * Fusiona todas las bases de datos de grupos clonados en una sola base de datos maestra "maestra.json".
 */

const fs = require('fs');
const path = require('path');
const { listarGruposClonados, leerGrupoClonado, guardarGrupoClonado } = require('../utils/clonador');
const { sendStyledMessage } = require('../utils/styles');

const confirmacionPendiente = new Map();

module.exports = {
  command: ['unidata', 'unificar', 'merge'],
  permission: 'admin',
  handler: async ({ sock, from, sender, args, isMe }) => {
    // 🛡️ Permisos
    const { isAuthorizedSender } = require('../utils/auth');
    if (!isMe && !isAuthorizedSender(sender)) return;

    if (args[0] === 'si' && confirmacionPendiente.has(from)) {
        const grupos = await listarGruposClonados();
        let totalUnificados = 0;
        const masterJids = new Set();

        for (const g of grupos) {
            const jids = await leerGrupoClonado(g);
            jids.forEach(j => masterJids.add(j));
        }

        const finalTotal = await guardarGrupoClonado('maestra', Array.from(masterJids));
        
        confirmacionPendiente.delete(from);
        await sendStyledMessage(sock, from, "𝚄𝚗𝚒𝚏𝚒𝚌𝚊𝚌𝚒ó𝚗 𝙴𝚡𝚒𝚝𝚘𝚜𝚊", 
            `🔗 Se han fusionado todos los grupos en: *maestra.json*\n\n` +
            `📂 Grupos procesados: ${grupos.length}\n` +
            `👥 Miembros totales únicos: ${finalTotal}\n\n` +
            `✅ Ahora puedes usar \`.invo\` y elegir "maestra" para agregar a todos los contactos juntos.`
        );
        return;
    }

    if (args[0] === 'no') {
        confirmacionPendiente.delete(from);
        await sock.sendMessage(from, { text: '❌ Unificación cancelada.' });
        return;
    }

    const grupos = await listarGruposClonados();
    if (grupos.length === 0) {
        return await sendStyledMessage(sock, from, "𝚂𝚒𝚗 𝙳𝚊𝚝𝚘𝚜", "No hay bases de datos para unificar.");
    }

    let menu = `Vas a fusionar las siguientes bases de datos:\n\n`;
    grupos.forEach((g, i) => menu += `• ${g}\n`);
    menu += `\n¿Deseas confirmar la creación de una base de datos maestra con todos estos miembros?\n\n`;
    menu += `👉 *{si}* --- *{no}*\n\n`;
    menu += `_Escribe ".unidata si" para confirmar o ".unidata no" para cancelar._`;

    confirmacionPendiente.set(from, true);
    await sendStyledMessage(sock, from, "𝚄𝚗𝚒𝚏𝚒𝚌𝚊𝚛 𝙱𝚊𝚜𝚎 𝚍𝚎 𝙳𝚊𝚝𝚘𝚜", menu);
  }
};
