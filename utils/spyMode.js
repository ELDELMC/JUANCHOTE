/**
 * 🕵️ MODO ESPÍA AUTOMÁTICO (Global y Permanente)
 * 
 * Intercepta los "sender" reales de los mensajes que viajan en TODOS los grupos 
 * de forma silenciosa y los vuelca al disco duro cada 30 segundos usando un 
 * único hilo global para máximo rendimiento.
 */

const { sanitizeGroupName, guardarGrupoClonado } = require('./clonador');

// Mapa global { groupJid: { name: "nombre_grupo", buffer: Set() } }
const groupBuffers = new Map();
let isLoopRunning = false;

// Helpers
async function ensureGroup(sock, groupJid) {
  if (!groupBuffers.has(groupJid)) {
    // Inicializar vacío para no bloquear mensajes concurrentes
    groupBuffers.set(groupJid, { name: null, buffer: new Set() });
    try {
      const metadata = await sock.groupMetadata(groupJid);
      const groupName = sanitizeGroupName(metadata.subject);
      groupBuffers.get(groupJid).name = groupName;
      console.log(`🕵️ [SPY AUTO] Radar encendido y monitoreando el grupo: ${groupName}`);
    } catch (e) {
      // Si falla, limpiar para que intente con el próximo mensaje
      console.error(`❌ [SPY AUTO] Fallo al leer metadatos de ${groupJid}`, e);
      groupBuffers.delete(groupJid);
    }
  }
}

function startGlobalSpyLoop() {
  if (isLoopRunning) return;
  isLoopRunning = true;
  console.log(`🕵️ [SPY AUTO] Hilo principal de recolección en segundo plano iniciado.`);

  setInterval(async () => {
    for (const [groupJid, data] of groupBuffers.entries()) {
      if (data.name && data.buffer.size > 0) {
        const jidsToSave = Array.from(data.buffer);
        console.log(`📡 [SPY FLUSH] Escribiendo en disco duro: ${jidsToSave.length} contactos nuevos en ${data.name}...`);
        
        // Guardar sin bloquear el loop de memoria
        await guardarGrupoClonado(data.name, jidsToSave).catch(e => console.error("Error Spy Flush", e));
        
        data.buffer.clear(); // Vaciar canasta para los siguientes
      }
    }
  }, 30000); // Vaciado masivo cada 30 segundos
}

/**
 * Función inyectada en el chorro principal (index.js)
 */
async function processSpyMessage(sock, groupJid, senderJid) {
  // Asegurar que el hilo de guardado esté girando
  startGlobalSpyLoop();

  // Ignorar cualquier ID irreal (como LIDs protegidos)
  if (!senderJid || !senderJid.includes('@s.whatsapp.net')) return;

  // Garantizar que sabemos quién es el grupo
  await ensureGroup(sock, groupJid);

  const groupData = groupBuffers.get(groupJid);
  if (!groupData) return;

  const previousSize = groupData.buffer.size;
  groupData.buffer.add(senderJid);

  // Dar feedback sutil si pescamos uno nuevo
  if (groupData.buffer.size > previousSize) {
    const rawNumber = senderJid.split('@')[0];
    console.log(`🕵️ [SPY CATCH] Atrapado en vuelo: ${rawNumber}`);
  }
}

/**
 * Por si el usuario quiere forzar el guardado y ver estadísticas con jijijija
 */
async function triggerForceFlush(groupJid) {
  const data = groupBuffers.get(groupJid);
  if (!data || !data.name) return { success: false, atrapados: 0, groupName: '' };
  
  const atrapados = data.buffer.size;
  if (atrapados > 0) {
    const jidsToSave = Array.from(data.buffer);
    await guardarGrupoClonado(data.name, jidsToSave);
    data.buffer.clear();
  }
  return { success: true, atrapados, groupName: data.name };
}

module.exports = {
  processSpyMessage,
  triggerForceFlush
};
