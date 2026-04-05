/**
 * 🕵️ MODO ESPÍA (SPY MODE)
 * Sistema de recolección pasiva de contactos burlando la encriptación LID
 * 
 * Intercepta los "sender" reales de los mensajes que viajan en un grupo y 
 * los agrega de forma silenciosa a la base de datos de clonación.
 */

const { sanitizeGroupName, guardarGrupoClonado } = require('./clonador');
const { sendStyledMessage } = require('./styles');

// Memoria principal de espionaje. { "groupJid": Set(JIDs reales recolectados) }
const spySessions = new Map();

// Gestor de intervalos de autoguardado { "groupJid": intervalID }
const spyIntervals = new Map();

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
  spySessions
};
