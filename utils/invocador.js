/**
 * 🚀 MOTOR DE INVITACIÓN MASIVA ANTI-BAN 2026
 * 
 * Agrega miembros UNO POR UNO con delays aleatorios
 * para evitar el ban de WhatsApp.
 * 
 * Tiempos:
 *  - Entre cada agregación: 90-180 seg + jitter sinusoidal
 *  - Cada 10 exitosas: pausa extra de 5-8 minutos
 *  - Error 403/429: pausa de 10 minutos
 */

const { leerGrupoClonado } = require('./clonador');
const { jidNormalizedUser } = require('@whiskeysockets/baileys');

// 🗺️ Map global de procesos activos: groupJid → { active, added, failed, total, stopped }
const currentInvoProcess = new Map();

// 🗺️ Map de estados pendientes: groupJid → { sender, timestamp, stage }
// stage: 'waiting_db_name' = esperando que el usuario escriba el nombre del grupo
const pendingInvo = new Map();

/**
 * Genera un delay aleatorio anti-ban con jitter sinusoidal
 * Rango base: 90-180 segundos + jitter de ±15 segundos
 */
function getRandomDelay() {
  const base = 90000 + Math.random() * 90000; // 90-180 seg
  const jitter = Math.sin(Date.now()) * 15000; // ±15 seg de jitter
  return Math.max(90000, Math.floor(base + jitter)); // Mínimo 90 seg
}

/**
 * Genera pausa extra larga (5-8 minutos) cada 10 agregaciones
 */
function getLongPause() {
  return 300000 + Math.random() * 180000; // 5-8 minutos
}

/**
 * Delay con Promise
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 🚀 Inicia el proceso de agregación masiva
 * @param {object} sock - Socket de Baileys
 * @param {string} groupJid - JID del grupo destino
 * @param {string} dbName - Nombre del archivo de grupo clonado (sin .json)
 * @param {string} sender - JID del admin que inició el proceso
 */
async function iniciarAgregacion(sock, groupJid, dbName, sender) {
  // Verificar que no haya proceso activo
  if (currentInvoProcess.has(groupJid) && currentInvoProcess.get(groupJid).active) {
    await sock.sendMessage(groupJid, { text: '⚠️ Ya hay un proceso de invitación activo en este grupo.\nUsa *.stopinvo* para detenerlo.' });
    return;
  }

  try {
    // 1. Verificar que el bot sea admin
    const metadata = await sock.groupMetadata(groupJid);
    const botJid = jidNormalizedUser(sock.user.id);
    const botParticipant = metadata.participants.find(p => jidNormalizedUser(p.id) === botJid);
    
    if (!botParticipant?.admin) {
      await sock.sendMessage(groupJid, { text: '❌ Necesito ser *administrador* de este grupo para agregar miembros.' });
      return;
    }

    // 2. Cargar la base de datos
    const jidsFromDb = await leerGrupoClonado(dbName);
    if (jidsFromDb.length === 0) {
      await sock.sendMessage(groupJid, { text: `❌ La base de datos *${dbName}* está vacía.` });
      return;
    }

    // 3. Filtrar: excluir los que ya están en el grupo
    const currentMembers = new Set(metadata.participants.map(p => jidNormalizedUser(p.id)));
    const toAdd = jidsFromDb.filter(jid => !currentMembers.has(jidNormalizedUser(jid)));

    if (toAdd.length === 0) {
      await sock.sendMessage(groupJid, { text: '✅ Todos los miembros de esa base de datos ya están en este grupo.' });
      return;
    }

    // 4. Inicializar estado del proceso
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

    await sock.sendMessage(groupJid, { 
      text: `🚀 *INVOCACIÓN INICIADA*\n\n📦 BD: *${dbName}*\n👥 Por agregar: *${toAdd.length}*\n⏱️ Tiempo estimado: ~${Math.ceil(toAdd.length * 2.5)} minutos\n\n_Cada agregación tiene delays aleatorios anti-ban._\n_Usa *.stopinvo* para detener._`
    });

    console.log(`\n🚀 [INVOCADOR] INICIO: ${toAdd.length} miembros desde ${dbName} → ${groupJid}`);

    // 5. Bucle de agregación UNO POR UNO
    for (let i = 0; i < toAdd.length; i++) {
      const state = currentInvoProcess.get(groupJid);
      
      // Verificar si fue detenido
      if (!state || !state.active || state.stopped) {
        console.log(`🛑 [INVOCADOR] Proceso detenido manualmente en ${groupJid}`);
        await sock.sendMessage(groupJid, { 
          text: `🛑 *INVOCACIÓN DETENIDA*\n\n✅ Agregados: ${state?.added || 0}\n❌ Fallidos: ${state?.failed || 0}\n⏭️ Restantes: ${toAdd.length - i}`
        });
        currentInvoProcess.delete(groupJid);
        return;
      }

      const jidToAdd = toAdd[i];
      const number = jidToAdd.split('@')[0];

      try {
        // Verificar si el bot sigue siendo admin
        if (i > 0 && i % 15 === 0) {
          const checkMeta = await sock.groupMetadata(groupJid);
          const stillAdmin = checkMeta.participants.find(p => jidNormalizedUser(p.id) === botJid);
          if (!stillAdmin?.admin) {
            console.log(`🚨 [INVOCADOR] Bot perdió admin en ${groupJid}. Deteniendo.`);
            await sock.sendMessage(groupJid, { text: '🚨 *PROCESO DETENIDO*: El bot ya no es administrador.' });
            currentInvoProcess.delete(groupJid);
            return;
          }
        }

        // Verificar si existe en WhatsApp (opcional, puede fallar)
        try {
          const [result] = await sock.onWhatsApp(number);
          if (!result?.exists) {
            console.log(`⏭️ [INVOCADOR] ${number} no existe en WhatsApp. Saltando.`);
            state.skipped++;
            continue;
          }
        } catch (e) {
          // Si onWhatsApp falla, intentar agregar de todos modos
          console.log(`⚠️ [INVOCADOR] No se pudo verificar ${number}, intentando agregar...`);
        }

        // ➕ AGREGAR
        console.log(`➕ [INVOCADOR] Agregando ${i + 1}/${toAdd.length}: ${number}`);
        await sock.groupParticipantsUpdate(groupJid, [jidToAdd], "add");
        state.added++;
        console.log(`✅ [INVOCADOR] ${number} agregado exitosamente.`);

      } catch (err) {
        state.failed++;
        const statusCode = err?.output?.statusCode || err?.data || 'desconocido';
        console.error(`❌ [INVOCADOR] Error agregando ${number}: ${statusCode}`);

        // Si es error 403, 429 o rate limit → pausa de 10 minutos
        if (statusCode === 403 || statusCode === 429 || String(err).includes('rate')) {
          console.log(`⏸️ [INVOCADOR] Rate limit detectado. Pausa de 10 minutos...`);
          await sock.sendMessage(groupJid, { text: `⏸️ Pausa de seguridad (10 min) por rate limit en ${number}...` });
          await sleep(600000); // 10 minutos
        }
      }

      // 📊 Progreso cada 5 agregaciones
      if ((i + 1) % 5 === 0) {
        const state = currentInvoProcess.get(groupJid);
        await sock.sendMessage(groupJid, { 
          text: `➕ Agregando ${i + 1}/${toAdd.length} • ✅ ${state.added} • ❌ ${state.failed} • ⏭️ ${state.skipped}`
        });
      }

      // ⏱️ Pausa extra cada 10 exitosas
      if (state.added > 0 && state.added % 10 === 0) {
        const longPause = getLongPause();
        console.log(`⏸️ [INVOCADOR] Pausa larga: ${Math.ceil(longPause / 60000)} minutos tras 10 exitosas.`);
        await sock.sendMessage(groupJid, { text: `⏸️ Pausa de seguridad de ${Math.ceil(longPause / 60000)} min tras 10 agregaciones exitosas...` });
        await sleep(longPause);
        continue; // No hacer el delay normal después de la pausa larga
      }

      // ⏱️ Delay normal anti-ban entre cada agregación
      if (i < toAdd.length - 1) {
        const delay = getRandomDelay();
        console.log(`⏱️ [INVOCADOR] Esperando ${Math.ceil(delay / 1000)} seg antes de la siguiente...`);
        await sleep(delay);
      }
    }

    // 6. Proceso completado
    const finalState = currentInvoProcess.get(groupJid);
    const elapsed = Math.ceil((Date.now() - finalState.startTime) / 60000);

    await sock.sendMessage(groupJid, { 
      text: `🏁 *INVOCACIÓN COMPLETADA*\n\n📦 BD: *${dbName}*\n✅ Agregados: ${finalState.added}\n❌ Fallidos: ${finalState.failed}\n⏭️ No existen: ${finalState.skipped}\n⏱️ Duración: ${elapsed} minutos`
    });

    console.log(`\n🏁 [INVOCADOR] COMPLETADO: ${finalState.added} agregados, ${finalState.failed} fallidos en ${elapsed} min.`);
    currentInvoProcess.delete(groupJid);

  } catch (err) {
    console.error('💥 [INVOCADOR] Error fatal:', err);
    await sock.sendMessage(groupJid, { text: '💥 Error fatal en el proceso de invitación.' });
    currentInvoProcess.delete(groupJid);
  }
}

/**
 * 🛑 Detiene el proceso activo en un grupo
 */
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
