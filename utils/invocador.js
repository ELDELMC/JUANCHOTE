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
const { sendStyledMessage } = require('./styles');

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

async function iniciarAgregacion(sock, groupJid, dbName, sender) {
  // Verificar que no haya proceso activo
  if (currentInvoProcess.has(groupJid) && currentInvoProcess.get(groupJid).active) {
    await sendStyledMessage(sock, groupJid, "𝙿𝚛𝚘𝚌𝚎𝚜𝚘 𝙰𝚌𝚝𝚒𝚟𝚘", "Ya hay un proceso de invitación activo en este grupo.\nUsa `.stopinvo` para detenerlo.");
    return;
  }

  try {
    const metadata = await sock.groupMetadata(groupJid);
    
    // Obtener los bots activos del manager (El enjambre)
    const { getAllBots } = require('./botManager');
    const botsActivos = getAllBots();

    // 1. Filtrar a los bots que REALMENTE tienen rango admin en este grupo
    const validAdminBots = [];
    console.log(`🔍 [INVOCADOR-MULTI] Analizando admin status para ${botsActivos.length} bots...`);
    
    for (const b of botsActivos) {
        try {
            if (!b || !b.user) continue;
            const bJid = jidNormalizedUser(b.user.id);
            
            // Forzar refresco de metadata si es posible (O usar la actual)
            const isAdmin = metadata.participants.some(p => jidNormalizedUser(p.id) === bJid && p.admin);
            
            // Si no está en la lista de participantes, Baileys a veces falla al verlos todos.
            // Si el bot es el MAIN, asumimos que intenta agregar. Si es SLAVE, probamos.
            const exists = metadata.participants.some(p => jidNormalizedUser(p.id) === bJid);
            
            if (isAdmin || !exists) {
                validAdminBots.push(b);
                console.log(`✅ Bot ${bJid} listo para trabajar.`);
            } else {
                console.log(`❌ Bot ${bJid} está en el grupo pero NO es admin.`);
            }
        } catch (e) {
            console.error(`⚠️ Error analizando un bot enjambre:`, e.message);
        }
    }

    if (validAdminBots.length === 0) {
      console.log(`🚫 [INVOCADOR-MULTI] Abortado: 0 bots con admin.`);
      await sendStyledMessage(sock, groupJid, "𝙴𝚛𝚛𝚘𝚛 𝚍𝚎 𝙿𝚎𝚛𝚖𝚒𝚜𝚘𝚜", "Ninguno de mis bots conectados tiene administrador en este grupo para agregar.");
      return;
    }

    // 2. Cargar la base de datos
    const jidsFromDb = await leerGrupoClonado(dbName);
    if (jidsFromDb.length === 0) {
      await sendStyledMessage(sock, groupJid, "𝙱𝙳 𝚅𝚊𝚌í𝚊", `La base de datos ${dbName} está vacía.`);
      return;
    }

    // 3. Filtrar: excluir los que ya están en el grupo
    const currentMembers = new Set(metadata.participants.map(p => jidNormalizedUser(p.id)));
    const toAdd = jidsFromDb.filter(jid => !currentMembers.has(jidNormalizedUser(jid)));

    if (toAdd.length === 0) {
      await sendStyledMessage(sock, groupJid, "𝚂𝚒𝚗 𝙼𝚒𝚎𝚖𝚋𝚛𝚘𝚜", "Todos los miembros de esa base de datos ya están en este grupo.");
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

    await sendStyledMessage(sock, groupJid, "𝙸𝚗𝚟𝚘𝚌𝚊𝚌𝚒ó𝚗 𝙸𝚗𝚒𝚌𝚒𝚊𝚍𝚊", `📦 BD: ${dbName}\n👥 Por agregar: ${toAdd.length}\n🤖 Bots trabajando: ${validAdminBots.length}\n⏱️ Tiempo estimado optimizado.\n\nCada agregación tiene delays aleatorios anti-ban.\nUsa .stopinvo para detener.`);

    console.log(`\n🚀 [INVOCADOR-MULTI] INICIO: ${toAdd.length} miembros desde ${dbName} → ${groupJid} usando ${validAdminBots.length} bots.`);

    // 5. Bucle de agregación (Round-Robin para distribuir carga entre bots)
    for (let i = 0; i < toAdd.length; i++) {
      const state = currentInvoProcess.get(groupJid);
      
      // Verificar si fue detenido
      if (!state || !state.active || state.stopped) {
        console.log(`🛑 [INVOCADOR] Proceso detenido manualmente en ${groupJid}`);
        await sendStyledMessage(sock, groupJid, "𝙸𝚗𝚟𝚘𝚌𝚊𝚌𝚒ó𝚗 𝙳𝚎𝚝𝚎𝚗𝚒𝚍𝚊", `✅ Agregados: ${state?.added || 0}\n❌ Fallidos: ${state?.failed || 0}\n⏭️ Restantes: ${toAdd.length - i}`);
        currentInvoProcess.delete(groupJid);
        return;
      }

      // 🔄 Asignación de Trabajo (Load Balancing)
      const workerBot = validAdminBots[i % validAdminBots.length];
      const jidToAdd = toAdd[i];
      const number = jidToAdd.split('@')[0];

      try {
        // Verificar si este worker sigue siendo admin cada ronda grande (se omite para no sobrecargar)

        // ➕ AGREGAR usando el bot seleccionado
        console.log(`➕ [INVOCADOR-W${(i % validAdminBots.length)+1}] Agregando ${i + 1}/${toAdd.length}: ${number}`);
        await workerBot.groupParticipantsUpdate(groupJid, [jidToAdd], "add");
        state.added++;
        console.log(`✅ [INVOCADOR] ${number} agregado exitosamente por Worker ${(i % validAdminBots.length)+1}.`);

      } catch (err) {
        state.failed++;
        const statusCode = err?.output?.statusCode || err?.data || err?.status || 'desconocido';
        console.error(`❌ [INVOCADOR] Error agregando ${number}: ${statusCode}`);

        // Error de permisos reales a la hora de la acción (si le quitaron admin a este bot específico)
        if (statusCode === 403) {
            console.log(`🚨 [INVOCADOR] WhatsApp retornó 403 Forbidden para el Worker asociado.`);
        }

        // Rate limit
        if (statusCode === 429 || String(err).includes('rate')) {
          console.log(`⏸️ [INVOCADOR] Rate limit detectado. Pausa de 10 minutos...`);
          await sendStyledMessage(workerBot, groupJid, "𝙿𝚊𝚞𝚜𝚊 𝚍𝚎 𝚂𝚎𝚐𝚞𝚛𝚒𝚍𝚊𝚍", `Pausa de 10 min por límite de velocidad en ${number}...`);
          await sleep(600000); // 10 minutos
        }
      }

      // 📊 Progreso cada 5 agregaciones
      if ((i + 1) % 5 === 0) {
        const state = currentInvoProcess.get(groupJid);
        await sendStyledMessage(sock, groupJid, "𝙿𝚛𝚘𝚐𝚛𝚎𝚜𝚘", `➕ Agregando ${i + 1}/${toAdd.length}\n✅ Exitosos: ${state.added}\n❌ Fallidos: ${state.failed}\n⏭️ Saltados: ${state.skipped}`);
      }

      // ⏱️ Pausa extra cada 10 exitosas
      if (state.added > 0 && state.added % 10 === 0) {
        const longPause = getLongPause();
        console.log(`⏸️ [INVOCADOR] Pausa larga: ${Math.ceil(longPause / 60000)} minutos tras 10 exitosas.`);
        await sendStyledMessage(sock, groupJid, "𝙿𝚊𝚞𝚜𝚊 𝚍𝚎 𝚂𝚎𝚐𝚞𝚛𝚒𝚍𝚊𝚍", `Pausa de ${Math.ceil(longPause / 60000)} min tras 10 agregaciones exitosas...`);
        await sleep(longPause);
        continue; // No hacer el delay normal después de la pausa larga
      }

      // ⏱️ Delay normal anti-ban entre cada agregación
      if (i < toAdd.length - 1) {
        // En Multi-sesión, el delay se puede reducir MUY MUY sutilmente proporcional a la cantidad de bots?
        // No, es mejor mantenerlo seguro para evitar chain-bans.
        const delay = getRandomDelay();
        console.log(`⏱️ [INVOCADOR] Esperando ${Math.ceil(delay / 1000)} seg antes de la siguiente...`);
        await sleep(delay);
      }
    }

    // 6. Proceso completado
    const finalState = currentInvoProcess.get(groupJid);
    const elapsed = Math.ceil((Date.now() - finalState.startTime) / 60000);

    await sendStyledMessage(sock, groupJid, "𝙸𝚗𝚟𝚘𝚌𝚊𝚌𝚒ó𝚗 𝙲𝚘𝚖𝚙𝚕𝚎𝚝𝚊𝚍𝚊", `📦 BD: ${dbName}\n✅ Agregados: ${finalState.added}\n❌ Fallidos: ${finalState.failed}\n⏭️ No existen: ${finalState.skipped}\n⏱️ Duración: ${elapsed} minutos`);

    console.log(`\n🏁 [INVOCADOR] COMPLETADO: ${finalState.added} agregados, ${finalState.failed} fallidos en ${elapsed} min.`);
    currentInvoProcess.delete(groupJid);

  } catch (err) {
    console.error('💥 [INVOCADOR] Error fatal:', err);
    await sendStyledMessage(sock, groupJid, "𝙴𝚛𝚛𝚘𝚛 𝙵𝚊𝚝𝚊𝚕", "Ocurrió un problema de interrupción en el proceso.");
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
