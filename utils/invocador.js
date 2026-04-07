/**
 * 🚀 MOTOR DE INVITACIÓN MASIVA ANTI-BAN 2026 (PERSISTENTE + SWARM)
 */

const fs = require('fs');
const path = require('path');
const { leerGrupoClonado } = require('./clonador');
const { jidNormalizedUser } = require('@whiskeysockets/baileys');
const { sendStyledMessage } = require('./styles');

// 💾 Persistencia
const STATE_FILE = path.join(__dirname, '../db/invo_state.json');

const currentInvoProcess = new Map();
const pendingInvo = new Map();

function saveInvoState() {
  try {
    const data = {};
    for (const [jid, state] of currentInvoProcess.entries()) {
      if (state.active && !state.stopped) {
        // Solo guardar lo serializable (sin funciones ni objetos circulares)
        data[jid] = {
          active: state.active,
          stopped: state.stopped,
          added: state.added || 0,
          failed: state.failed || 0,
          total: state.total || 0,
          dbName: state.dbName,
          startTime: state.startTime,
          currentIndex: state.currentIndex || 0
        };
      }
    }
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('💥 [INVO] Error guardando estado:', e.message);
  }
}

function loadInvoState() {
  if (!fs.existsSync(STATE_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  } catch (e) {
    return {};
  }
}

function clearInvoState() {
  try {
    fs.writeFileSync(STATE_FILE, '{}');
  } catch (e) {}
}

function getRandomDelay() {
  const base = 90000 + Math.random() * 90000;
  const jitter = Math.sin(Date.now()) * 15000;
  return Math.max(90000, Math.floor(base + jitter)); 
}

function getLongPause() {
  return 300000 + Math.random() * 180000;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 🔄 REANUDACIÓN AUTOMÁTICA
 * Se llama cuando el bot principal se conecta.
 * Espera a que los bots auxiliares también estén listos.
 */
async function resumeProcesses(sock) {
  const savedState = loadInvoState();
  const jids = Object.keys(savedState);
  
  if (jids.length === 0) {
    console.log('✅ [RESUME] No hay procesos pendientes.');
    return;
  }
  
  console.log(`📡 [RESUME] Detectados ${jids.length} procesos de invitación pendientes.`);
  
  // Esperar 10 segundos extra para que los bots auxiliares se conecten
  await sleep(10000);
  
  for (const jid of jids) {
    const s = savedState[jid];
    
    // Validar que el estado tenga datos necesarios
    if (!s.dbName) {
      console.warn(`⚠️ [RESUME] Estado inválido para ${jid}, limpiando...`);
      continue;
    }
    
    // Evitar duplicar si ya cargó
    if (currentInvoProcess.has(jid)) continue;
    
    console.log(`🚀 [RESUME] Reanudando agregación en ${jid} desde índice ${s.currentIndex || 0} (BD: ${s.dbName})...`);
    
    try {
      await iniciarAgregacion(sock, jid, s.dbName, 'SISTEMA', true, s);
    } catch (e) {
      console.error(`💥 [RESUME] Falló reanudación en ${jid}:`, e.message);
    }
  }
}

async function iniciarAgregacion(sock, groupJid, dbName, sender, isResuming = false, resumeData = null) {
  if (!isResuming && currentInvoProcess.has(groupJid) && currentInvoProcess.get(groupJid).active) {
    await sendStyledMessage(sock, groupJid, "𝙿𝚛𝚘𝚌𝚎𝚜𝚘 𝙰𝚌𝚝𝚒𝚟𝚘", "Ya hay un proceso activo en este grupo.\nUsa `.stopinvo` para detenerlo primero.");
    return;
  }

  try {
    const { getBot, activeBots } = require('./botManager');
    
    // Obtener metadata del grupo
    let metadata;
    try {
      metadata = await sock.groupMetadata(groupJid);
    } catch (e) {
      console.error(`💥 [INVO] No puedo obtener metadata de ${groupJid}:`, e.message);
      if (isResuming) clearInvoState();
      return;
    }

    // Buscar bots válidos (intentamos agregar con cualquiera que esté conectado)
    const validBotNames = [];
    for (const sessionName of activeBots.keys()) {
        try {
            const b = getBot(sessionName);
            if (!b || !b.user) continue;
            validBotNames.push(sessionName);
        } catch (e) {}
    }

    if (validBotNames.length === 0) {
      console.warn(`⚠️ [INVO] No hay bots conectados para agregar miembros.`);
      if (!isResuming) {
        await sendStyledMessage(sock, groupJid, "𝙴𝚛𝚛𝚘𝚛", "No hay bots conectados.");
      }
      return;
    }

    console.log(`🤖 [INVO] Bots disponibles: ${validBotNames.join(', ')}`);

    // Leer BD de contactos
    const jidsFromDb = await leerGrupoClonado(dbName);
    if (!jidsFromDb || jidsFromDb.length === 0) {
      console.warn(`⚠️ [INVO] La BD "${dbName}" está vacía o no existe.`);
      if (isResuming) clearInvoState();
      return;
    }

    // Filtrar los que ya están en el grupo
    const currentMembers = new Set(metadata.participants.map(p => jidNormalizedUser(p.id)));
    const allToAdd = jidsFromDb.filter(jid => !currentMembers.has(jidNormalizedUser(jid)));

    if (allToAdd.length === 0) {
      console.log(`✅ [INVO] Todos los miembros de "${dbName}" ya están en el grupo.`);
      if (!isResuming) {
        await sendStyledMessage(sock, groupJid, "𝚂𝚒𝚗 𝙼𝚒𝚎𝚖𝚋𝚛𝚘𝚜", "Todos los contactos ya están en el grupo.");
      }
      currentInvoProcess.delete(groupJid);
      clearInvoState();
      return;
    }

    // Calcular el índice real de inicio
    // En resume, el currentIndex era sobre la lista VIEJA. Si la lista cambió, recalculamos.
    let startIndex = 0;
    if (isResuming && resumeData) {
      // Si el total anterior coincide, usamos el índice guardado
      // Si no, empezamos desde 0 con la lista recalculada (ya filtrada)
      if (resumeData.total === allToAdd.length) {
        startIndex = resumeData.currentIndex || 0;
      } else {
        console.log(`🔄 [INVO] Lista cambió (era ${resumeData.total}, ahora ${allToAdd.length}). Recalculando desde 0.`);
        startIndex = 0;
      }
    }

    // Estado del proceso
    const state = {
      active: true,
      stopped: false,
      added: isResuming ? (resumeData?.added || 0) : 0,
      failed: isResuming ? (resumeData?.failed || 0) : 0,
      total: allToAdd.length,
      dbName,
      startTime: isResuming ? (resumeData?.startTime || Date.now()) : Date.now(),
      currentIndex: startIndex
    };
    
    currentInvoProcess.set(groupJid, state);
    saveInvoState();

    if (!isResuming) {
       await sendStyledMessage(sock, groupJid, "𝙸𝚗𝚟𝚘𝚌𝚊𝚌𝚒ó𝚗 𝙸𝚗𝚒𝚌𝚒𝚊𝚍𝚊", `📦 BD: ${dbName}\n👥 Por agregar: ${allToAdd.length}\n🤖 Bots: ${validBotNames.length}`);
    } else {
       const pendientes = allToAdd.length - startIndex;
       await sendStyledMessage(sock, groupJid, "𝚁𝚎𝚊𝚗𝚞𝚍𝚊𝚗𝚍𝚘...", `Invocación reanudada por reinicio.\n📦 BD: ${dbName}\n➕ Pendientes: ${pendientes}`);
    }

    // 🔄 Bucle principal de agregación
    for (let i = startIndex; i < allToAdd.length; i++) {
      // Actualizar progreso
      state.currentIndex = i;
      saveInvoState();

      // Verificar si fue detenido
      if (!state.active || state.stopped) {
        console.log(`🛑 [INVO] Proceso detenido en ${groupJid}.`);
        await sendStyledMessage(sock, groupJid, "𝙳𝚎𝚝𝚎𝚗𝚒𝚍𝚘", `Proceso detenido.\n✅ Agregados: ${state.added}\n❌ Fallidos: ${state.failed}`);
        currentInvoProcess.delete(groupJid);
        clearInvoState();
        return;
      }

      // Seleccionar bot worker (round-robin)
      const sessionName = validBotNames[i % validBotNames.length];
      const workerBot = getBot(sessionName) || sock; 
      
      const jidToAdd = allToAdd[i];
      const number = jidToAdd.split('@')[0];

      try {
        console.log(`➕ [W:${sessionName}] Agregando ${i + 1}/${allToAdd.length}: ${number}`);
        await workerBot.groupParticipantsUpdate(groupJid, [jidToAdd], "add");
        state.added++;
        saveInvoState();
      } catch (err) {
        state.failed++;
        const errCode = err?.output?.statusCode;
        console.warn(`❌ [INVO] Falló agregar ${number}: ${err.message || errCode || 'desconocido'}`);
        
        if (errCode === 429) {
          console.log(`⏸️ [INVO] Rate limit (429). Pausa de 10 minutos...`);
          await sleep(600000);
        }
        saveInvoState();
      }

      // Reporte de progreso cada 5 agregados
      if ((i + 1) % 5 === 0) {
        try {
          await sendStyledMessage(sock, groupJid, "𝙿𝚛𝚘𝚐𝚛𝚎𝚜𝚘", `➕ ${i + 1}/${allToAdd.length}\n✅ Exitosos: ${state.added}\n❌ Fallidos: ${state.failed}`);
        } catch (e) {}
      }

      // Delay anti-ban
      const delay = (state.added > 0 && state.added % 10 === 0) ? getLongPause() : getRandomDelay();
      await sleep(delay);
    }

    // ✅ Proceso completado
    console.log(`🏁 [INVO] Invocación completada en ${groupJid}. Agregados: ${state.added}, Fallidos: ${state.failed}`);
    try {
      await sendStyledMessage(sock, groupJid, "𝙸𝚗𝚟𝚘𝚌𝚊𝚌𝚒ó𝚗 𝙲𝚘𝚖𝚙𝚕𝚎𝚝𝚊𝚍𝚊", `✅ Agregados: ${state.added}\n❌ Fallidos: ${state.failed}\n📦 BD: ${dbName}`);
    } catch (e) {
      console.warn(`⚠️ [INVO] No se pudo enviar mensaje final (conexión caída), pero el proceso terminó OK.`);
    }
    currentInvoProcess.delete(groupJid);
    clearInvoState();

  } catch (err) {
    const isConnectionError = err?.message?.includes('Connection Closed') || err?.output?.statusCode === 428;
    if (isConnectionError) {
      console.warn(`⚠️ [INVO] Conexión caída durante invocación. El proceso se reanudará al reconectar.`);
      // NO limpiamos el estado para que se pueda reanudar
    } else {
      console.error('💥 [INVOCADOR] Error crítico:', err);
      currentInvoProcess.delete(groupJid);
      clearInvoState();
    }
  }
}

function detenerAgregacion(groupJid) {
  const state = currentInvoProcess.get(groupJid);
  if (state) {
    state.active = false;
    state.stopped = true;
    saveInvoState();
    return true;
  }
  return false;
}

module.exports = {
  currentInvoProcess,
  pendingInvo,
  iniciarAgregacion,
  detenerAgregacion,
  resumeProcesses
};
