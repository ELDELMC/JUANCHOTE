/**
 * 🚀 MOTOR DE INVITACIÓN MASIVA ANTI-BAN 2026 (PERSISTENTE)
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
  const data = {};
  for (const [jid, state] of currentInvoProcess.entries()) {
    if (state.active) data[jid] = state;
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2));
}

function loadInvoState() {
  if (!fs.existsSync(STATE_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  } catch (e) {
    return {};
  }
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
 * Se llama cuando el bot principal se conecta
 */
async function resumeProcesses(sock) {
  const savedState = loadInvoState();
  const jids = Object.keys(savedState);
  
  if (jids.length === 0) return;
  
  console.log(`📡 [RESUME] Detectados ${jids.length} procesos de invitación pendientes.`);
  
  for (const jid of jids) {
    const s = savedState[jid];
    // Evitar duplicar si ya cargó por algún motivo
    if (currentInvoProcess.has(jid)) continue;
    
    // Inyectar en el map y lanzar el bucle
    console.log(`🚀 [RESUME] Reanudando agregación en ${jid} desde índice ${s.currentIndex || 0}...`);
    iniciarAgregacion(sock, jid, s.dbName, 'SISTEMA', true, s);
  }
}

async function iniciarAgregacion(sock, groupJid, dbName, sender, isResuming = false, resumeData = null) {
  if (!isResuming && currentInvoProcess.has(groupJid) && currentInvoProcess.get(groupJid).active) {
    await sendStyledMessage(sock, groupJid, "𝙿𝚛𝚘𝚌𝚎𝚜𝚘 𝙰𝚌𝚝𝚒𝚟𝚘", "Ya hay un proceso activo en este grupo.");
    return;
  }

  try {
    const { getBot, activeBots } = require('./botManager');
    const metadata = await sock.groupMetadata(groupJid);
    
    const validBotNames = [];
    for (const sessionName of activeBots.keys()) {
        try {
            const b = getBot(sessionName);
            if (!b || !b.user) continue;
            const bJid = jidNormalizedUser(b.user.id);
            const isAdmin = metadata.participants.some(p => jidNormalizedUser(p.id) === bJid && p.admin);
            const exists = metadata.participants.some(p => jidNormalizedUser(p.id) === bJid);
            if (isAdmin || !exists) {
                validBotNames.push(sessionName);
            }
        } catch (e) {}
    }

    if (validBotNames.length === 0) {
      if (!isResuming) await sendStyledMessage(sock, groupJid, "𝙴𝚛𝚛𝚘𝚛 𝚍𝚎 𝙿𝚎𝚛𝚖𝚒𝚜𝚘𝚜", "Ninguno de mis bots conectados tiene administrador.");
      return;
    }

    const jidsFromDb = await leerGrupoClonado(dbName);
    const currentMembers = new Set(metadata.participants.map(p => jidNormalizedUser(p.id)));
    const allToAdd = jidsFromDb.filter(jid => !currentMembers.has(jidNormalizedUser(jid)));

    if (allToAdd.length === 0) {
      if (!isResuming) await sendStyledMessage(sock, groupJid, "𝚂𝚒𝚗 𝙼𝚒𝚎𝚖𝚋𝚛𝚘𝚜", "Todos ya están en el grupo.");
      return;
    }

    // 🏗️ Configurar estado inicial o cargado
    const state = isResuming ? resumeData : {
      active: true,
      stopped: false,
      added: isResuming ? resumeData.added : 0,
      failed: isResuming ? resumeData.failed : 0,
      total: allToAdd.length,
      dbName,
      startTime: isResuming ? resumeData.startTime : Date.now(),
      currentIndex: 0
    };
    
    currentInvoProcess.set(groupJid, state);
    saveInvoState();

    if (!isResuming) {
       await sendStyledMessage(sock, groupJid, "𝙸𝚗𝚟𝚘𝚌𝚊𝚌𝚒ó𝚗 𝙸𝚗𝚒𝚌𝚒𝚊𝚍𝚊", `📦 BD: ${dbName}\n👥 Por agregar: ${allToAdd.length}\n🤖 Bots: ${validBotNames.length}`);
    } else {
       await sendStyledMessage(sock, groupJid, "𝚁𝚎𝚊𝚗𝚞𝚍𝚊𝚗𝚍𝚘...", `Invocación reanudada por reinicio.\n➕ Pendiente: ${allToAdd.length - state.currentIndex}`);
    }

    // 🔄 El bucle ahora usa el índice del estado
    for (let i = (state.currentIndex || 0); i < allToAdd.length; i++) {
      state.currentIndex = i;
      saveInvoState(); // Guardar progreso en cada paso

      if (!state.active || state.stopped) {
        await sendStyledMessage(sock, groupJid, "𝙳𝚎𝚝𝚎𝚗𝚒𝚍𝚘", `Proceso detenido.`);
        currentInvoProcess.delete(groupJid);
        saveInvoState();
        return;
      }

      const sessionName = validBotNames[i % validBotNames.length];
      const workerBot = getBot(sessionName) || sock; 
      
      const jidToAdd = allToAdd[i];
      const number = jidToAdd.split('@')[0];

      try {
        console.log(`➕ [W${(i % validBotNames.length)+1}] Agregando ${i + 1}/${allToAdd.length}: ${number}`);
        await workerBot.groupParticipantsUpdate(groupJid, [jidToAdd], "add");
        state.added++;
        saveInvoState();
      } catch (err) {
        state.failed++;
        if (err?.output?.statusCode === 429) await sleep(600000);
      }

      if ((i + 1) % 5 === 0) {
        await sendStyledMessage(sock, groupJid, "𝙿𝚛𝚘𝚐𝚛𝚎𝚜𝚘", `➕ Agregando ${i + 1}/${allToAdd.length}\n✅ Exitosos: ${state.added}`);
      }

      const delay = (state.added > 0 && state.added % 10 === 0) ? getLongPause() : getRandomDelay();
      await sleep(delay);
    }

    await sendStyledMessage(sock, groupJid, "𝙸𝚗𝚟𝚘𝚌𝚊𝚌𝚒ó𝚗 𝙲𝚘𝚖𝚙𝚕𝚎𝚝𝚊𝚍𝚊", `Finalizado con ${state.added} nuevos.`);
    currentInvoProcess.delete(groupJid);
    saveInvoState();

  } catch (err) {
    console.error('💥 [INVOCADOR] Error:', err);
    currentInvoProcess.delete(groupJid);
    saveInvoState();
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
