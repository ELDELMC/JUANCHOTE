/**
 * 🕵️ MODO ESPÍA (SPY MODE)
 * Sistema de recolección pasiva de contactos burlando la encriptación LID
 * 
 * Intercepta los "sender" reales de los mensajes que viajan en un grupo y 
 * los agrega de forma silenciosa a la base de datos de clonación.
 */

const { sanitizeGroupName, guardarGrupoClonado } = require('./clonador');
const { sendStyledMessage } = require('./styles');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const STATE_FILE = path.join(__dirname, '..', 'db', 'espionaje.json');

// Memoria principal de espionaje. { "groupJid": Set(JIDs reales recolectados) }
const spySessions = new Map();

// Gestor de intervalos de autoguardado { "groupJid": intervalID }
const spyIntervals = new Map();

async function loadSpyState(sock) {
  try {
    const data = await fsp.readFile(STATE_FILE, 'utf-8');
    const state = JSON.parse(data);
    if (state && state.grupos) {
      for (const [groupJid, isActive] of Object.entries(state.grupos)) {
        if (isActive && !spySessions.has(groupJid)) {
           try {
             const metadata = await sock.groupMetadata(groupJid);
             await startSpy(sock, groupJid, true, metadata);
           } catch(e) {
             console.log(`❌ [SPY] No se pudo reanudar en ${groupJid}`);
           }
        }
      }
    }
  } catch(e) {
    // Archivo no existe o error, no hacer nada
  }
}

async function saveSpyState() {
  try {
    await fsp.mkdir(path.dirname(STATE_FILE), { recursive: true });
    let existing = { grupos: {} };
    if (fs.existsSync(STATE_FILE)) {
      existing = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
    
    // Todos los activos a true
    for (const jid of spySessions.keys()) {
      existing.grupos[jid] = true;
    }
    
    // Si estaba pero ya no, false
    for (const jid of Object.keys(existing.grupos)) {
      if (!spySessions.has(jid)) {
        existing.grupos[jid] = false;
      }
    }
    
    await fsp.writeFile(STATE_FILE, JSON.stringify(existing, null, 2), 'utf-8');
  } catch(e) {
    console.error("❌ [SPY] Error al guardar estado persistente:", e);
  }
}

/**
 * Activa el modo espía en un grupo
 */
async function startSpy(sock, groupJid, isGroup, metadata) {
  if (!isGroup || !metadata) return false;

  const groupName = sanitizeGroupName(metadata.subject);

  if (spySessions.has(groupJid)) {
    return false; // Ya estaba activado
  }

  // Inicializar Buffer
  spySessions.set(groupJid, new Set());

  // Crear intervalo de autoguardado (cada 30 segundos vacía la memoria al json)
  const interval = setInterval(async () => {
    const buffer = spySessions.get(groupJid);
    if (buffer && buffer.size > 0) {
      const jidsToSave = Array.from(buffer);
      console.log(`🕵️ [SPY] Vaciando buffer auto-guardado en ${groupName}... (${jidsToSave.length} atrapados)`);
      await guardarGrupoClonado(groupName, jidsToSave);
      // Limpiar buffer
      buffer.clear();
    }
  }, 30000);

  spyIntervals.set(groupJid, interval);
  console.log(`🕵️ [SPY] Inició espionaje pasivo en: ${groupName}`);
  
  await saveSpyState();
  return true;
}

/**
 * Detiene el espionaje y hace un flush compulsivo
 */
async function stopSpy(sock, groupJid, metadata) {
  if (!spySessions.has(groupJid)) {
    return { success: false, totalObtenidosReciente: 0, groupName: '' };
  }

  const groupName = sanitizeGroupName(metadata.subject);
  const buffer = spySessions.get(groupJid);
  let recientes = 0;

  // Flush final obligado
  if (buffer && buffer.size > 0) {
    const jidsToSave = Array.from(buffer);
    recientes = jidsToSave.length;
    await guardarGrupoClonado(groupName, jidsToSave);
  }

  // Desactivar y limpiar
  clearInterval(spyIntervals.get(groupJid));
  spyIntervals.delete(groupJid);
  spySessions.delete(groupJid);

  await saveSpyState();

  console.log(`🕵️ [SPY] Detenido en: ${groupName}`);
  return { success: true, totalObtenidosReciente: recientes, groupName };
}

/**
 * La función que va conectada al chorro principal de mensajes
 * Llama a esta función en index.js cada vez que alguien habla
 */
async function processSpyMessage(groupJid, senderJid) {
  // Si este grupo no está bajo espionaje, ignorar instantáneamente
  if (!spySessions.has(groupJid)) return;

  // Si el mensaje es de una IA o LIDs no podemos hacer mucho si son IDs raros
  // pero los números normales @s.whatsapp.net pasan.
  if (!senderJid.includes('@s.whatsapp.net')) return;

  const buffer = spySessions.get(groupJid);
  
  // Agregar al Set (si ya existe, el Set evita duplicados)
  const previousSize = buffer.size;
  buffer.add(senderJid);
  
  if (buffer.size > previousSize) {
    console.log(`🕵️ [SPY] Nuevo número real atrapado en vuelo: ${senderJid.split('@')[0]}`);
  }
}

module.exports = {
  startSpy,
  stopSpy,
  processSpyMessage,
  loadSpyState,
  spySessions
};
