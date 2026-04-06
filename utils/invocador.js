/**
 * 🚀 MOTOR DE INVITACIÓN MASIVA ANTI-BAN 2026
 * 
 * Agrega miembros UNO POR UNO con delays aleatorios
 * para evitar el ban de WhatsApp.
 */

const { leerGrupoClonado } = require('./clonador');
const { jidNormalizedUser } = require('@whiskeysockets/baileys');
const { sendStyledMessage } = require('./styles');

// 🗺️ Map global de procesos activos: groupJid → { active, added, failed, total, stopped }
const currentInvoProcess = new Map();
const pendingInvo = new Map();

function getRandomDelay() {
  const base = 90000 + Math.random() * 90000; // 90-180 seg
  const jitter = Math.sin(Date.now()) * 15000; // ±15 seg
  return Math.max(90000, Math.floor(base + jitter)); 
}

function getLongPause() {
  return 300000 + Math.random() * 180000; // 5-8 minutos
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function iniciarAgregacion(sock, groupJid, dbName, sender) {
  if (currentInvoProcess.has(groupJid) && currentInvoProcess.get(groupJid).active) {
    await sendStyledMessage(sock, groupJid, "𝙿𝚛𝚘𝚌𝚎𝚜𝚘 𝙰𝚌𝚝𝚒𝚟𝚘", "Ya hay un proceso activo en este grupo.");
    return;
  }

  try {
    const { getBot, activeBots } = require('./botManager');
    const metadata = await sock.groupMetadata(groupJid);
    
    // 1. Filtrar a los bots que REALMENTE tienen rango admin en este grupo
    const validBotNames = [];
    console.log(`🔍 [INVOCADOR-MULTI] Analizando ${activeBots.size} bots enjambre...`);
    
    for (const sessionName of activeBots.keys()) {
        try {
            const b = getBot(sessionName);
            if (!b || !b.user) continue;
            const bJid = jidNormalizedUser(b.user.id);
            
            const isAdmin = metadata.participants.some(p => jidNormalizedUser(p.id) === bJid && p.admin);
            // Si el bot fue añadido recién y la metadata no se ha refrescado, asumimos que puede intentar
            const exists = metadata.participants.some(p => jidNormalizedUser(p.id) === bJid);
            
            if (isAdmin || !exists) {
                validBotNames.push(sessionName);
                console.log(`✅ Bot [${sessionName}] listo para trabajar.`);
            }
        } catch (e) {
            console.error(`⚠️ Error analizando bot ${sessionName}:`, e.message);
        }
    }

    if (validBotNames.length === 0) {
      await sendStyledMessage(sock, groupJid, "𝙴𝚛𝚛𝚘𝚛 𝚍𝚎 𝙿𝚎𝚛𝚖𝚒𝚜𝚘𝚜", "Ninguno de mis bots conectados tiene administrador aquí.");
      return;
    }

    // 2. Cargar y filtrar base de datos
    const jidsFromDb = await leerGrupoClonado(dbName);
    const currentMembers = new Set(metadata.participants.map(p => jidNormalizedUser(p.id)));
    const toAdd = jidsFromDb.filter(jid => !currentMembers.has(jidNormalizedUser(jid)));

    if (toAdd.length === 0) {
      await sendStyledMessage(sock, groupJid, "𝚂𝚒𝚗 𝙼𝚒𝚎𝚖𝚋𝚛𝚘𝚜", "Todos ya están en el grupo.");
      return;
    }

    // 3. Inicializar estado
    const processState = {
      active: true,
      stopped: false,
      added: 0,
      failed: 0,
      skipped: 0,
      total: toAdd.length,
      dbName,
      startTime: Date.now()
    };
    currentInvoProcess.set(groupJid, processState);

    await sendStyledMessage(sock, groupJid, "𝙸𝚗𝚟𝚘𝚌𝚊𝚌𝚒ó𝚗 𝙸𝚗𝚒𝚌𝚒𝚊𝚍𝚊", `📦 BD: ${dbName}\n👥 Por agregar: ${toAdd.length}\n🤖 Bots trabajando: ${validBotNames.length}\n\nDistribuyendo carga entre todos los bots conectados.`);

    // 4. Bucle Round-Robin
    for (let i = 0; i < toAdd.length; i++) {
      const state = currentInvoProcess.get(groupJid);
      if (!state || !state.active || state.stopped) {
        await sendStyledMessage(sock, groupJid, "𝙳𝚎𝚝𝚎𝚗𝚒𝚍𝚘", `Proceso detenido.\n✅ Agregados: ${state?.added || 0}\n⏭️ Restantes: ${toAdd.length - i}`);
        currentInvoProcess.delete(groupJid);
        return;
      }

      // Obtener el worker actual y su conexión más fresca
      const sessionName = validBotNames[i % validBotNames.length];
      const workerBot = getBot(sessionName) || sock; 
      
      const jidToAdd = toAdd[i];
      const number = jidToAdd.split('@')[0];

      try {
        console.log(`➕ [W${(i % validBotNames.length)+1}] (${sessionName}) Agregando ${i + 1}/${toAdd.length}: ${number}`);
        await workerBot.groupParticipantsUpdate(groupJid, [jidToAdd], "add");
        state.added++;
        console.log(`✅ [INVOCADOR] ${number} agregado.`);
      } catch (err) {
        state.failed++;
        console.error(`❌ [INVOCADOR] Error en ${number}:`, err?.output?.statusCode || 'error');
        
        if (err?.output?.statusCode === 429) {
           console.log(`⏸️ Rate limit en ${sessionName}. Pausa de 10 min.`);
           await sleep(600000);
        }
      }

      // Progreso y pausas
      if ((i + 1) % 5 === 0) {
        await sendStyledMessage(sock, groupJid, "𝙿𝚛𝚘𝚐𝚛𝚎𝚜𝚘", `➕ Agregando ${i + 1}/${toAdd.length}\n✅ Exitosos: ${state.added}\n❌ Fallidos: ${state.failed}`);
      }

      if (state.added > 0 && state.added % 10 === 0) {
        const lp = getLongPause();
        await sleep(lp);
      } else if (i < toAdd.length - 1) {
        await sleep(getRandomDelay());
      }
    }

    await sendStyledMessage(sock, groupJid, "𝙸𝚗𝚟𝚘𝚌𝚊𝚌𝚒ó𝚗 𝙲𝚘𝚖𝚙𝚕𝚎𝚝𝚊𝚍𝚊", `✅ Finalizado con ${currentInvoProcess.get(groupJid).added} miembros nuevos.`);
    currentInvoProcess.delete(groupJid);

  } catch (err) {
    console.error('💥 [INVOCADOR] Error fatal:', err);
    currentInvoProcess.delete(groupJid);
  }
}

function detenerAgregacion(groupJid) {
  const state = currentInvoProcess.get(groupJid);
  if (state && state.active) {
    state.active = false;
    state.stopped = true;
    return true;
  }
  return false;
}

module.exports = {
  currentInvoProcess,
  pendingInvo,
  iniciarAgregacion,
  detenerAgregacion
};
