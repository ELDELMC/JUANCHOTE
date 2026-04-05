try {
  require('dotenv').config();
} catch (e) {
  console.log('ℹ️ No se cargó el archivo .env (se usarán variables del sistema/panel)');
}

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  jidNormalizedUser
} = require('@whiskeysockets/baileys');

const P = require('pino');
const qrcode = require('qrcode-terminal');

// 🛑 Manejo global de errores (para que el bot no muera en silencio)
process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 RECHAZO NO MANEJADO en:', promise, 'razón:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('💥 EXCEPCIÓN NO CAPTURADA:', err);
});

const { getText, normalizeString, checkAdmin, isGroup, getIsAdmin, matchPrefix } = require('./utils/helpers');
const { hasPermission } = require('./utils/permissions');
const { askAI: handleAI, detectarIntencionContable } = require('./utils/ai');
const { transcribeAudio, textToSpeech } = require('./utils/audio');
const { getGroupSettings } = require('./utils/settings');
const { isUserMuted } = require('./utils/mute');
const { iniciarCuenta, sumarValor, obtenerSesion, finalizarCuenta } = require('./utils/accounts');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { sanitizeGroupName, guardarGrupoClonado } = require('./utils/clonador');
const { pendingInvo, iniciarAgregacion } = require('./utils/invocador');
const { cargarUsuariosAutorizados, isAuthorizedSender, isRestrictedCommand } = require('./utils/auth');
const { handleModeration, cleanSpamTracker } = require('./utils/moderation');
const { handleGroupParticipantsUpdate } = require('./utils/groupEvents');

const fs = require('fs');
const path = require('path');

// 🔄 Carga dinámica de comandos
const comandosPath = path.join(__dirname, 'comandos');
const commandFiles = fs.readdirSync(comandosPath).filter(file => file.endsWith('.js'));
const commands = new Map();

for (const file of commandFiles) {
  const cmdModule = require(path.join(comandosPath, file));
  if (cmdModule.command && cmdModule.handler) {
    if (Array.isArray(cmdModule.command)) {
      cmdModule.command.forEach(cmd => commands.set(normalizeString(cmd), cmdModule));
    } else {
      commands.set(normalizeString(cmdModule.command), cmdModule);
    }
  }
}

// Helper auxiliar para admin removido (usando helpers.js)

let botStartTime = Date.now();

// 🔐 Cargar permisos autorizados al inicio
cargarUsuariosAutorizados();

// 🧹 Limpieza periódica de memoria (Anti-Spam) cada 5 minutos
setInterval(cleanSpamTracker, 5 * 60 * 1000);

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`📡 Conectando con versión de WA v${version.join('.')} (Latest: ${isLatest})`);

  // 🔍 Diagnóstico de APIs (Debug para BoxMineWorld)
  console.log('\n--- 🔍 [DIAGNÓSTICO API] ---');
  const keys = {
      'GEMINI_API_KEY': process.env.GEMINI_API_KEY,
      'GROQ_API_KEY': process.env.GROQ_API_KEY,
      'XAI_API_KEY': process.env.XAI_API_KEY
  };

  for (const [name, value] of Object.entries(keys)) {
      if (value) {
          const isDotEnv = value === require('dotenv').config().parsed?.[name];
          const source = isDotEnv ? '.env' : 'Sistema/Panel';
          console.log(`✅ ${name}: CONFIGURADA (Origen: ${source})`);
      } else {
          console.log(`❌ ${name}: NO CONFIGURADA`);
      }
  }
  console.log('---------------------------\n');
  
  if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY && !process.env.XAI_API_KEY) {
    console.warn('⚠️ [ALERTA] No se detectó ninguna llave de IA en el entorno. Revisa el archivo .env o las variables en el panel.');
  }

  const sock = makeWASocket({
    auth: state,
    version,
    logger: P({ level: 'silent' }), // 📝 Cambiado a silent para limpiar logs, pero puedes usar 'info' si necesitas debugar
    browser: ['Ubuntu', 'Chrome', '131.0.6778.85']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    // 📱 Mostrar QR en consola
    if (qr) {
      console.log('📱 Escanea este QR con WhatsApp:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      console.log('✅ BOT CONECTADO');
    }

    if (connection === 'close') {
      const error = lastDisconnect?.error;

      console.log('❌ Conexión cerrada');

      if (error) {
        console.log('💥 ERROR DETALLADO:');
        console.log(error);
      }

      const statusCode = error?.output?.statusCode;

      console.log('📊 Código:', statusCode);

      const shouldReconnect =
        statusCode !== DisconnectReason.loggedOut;

      if (shouldReconnect) {
        console.log('🔄 Reconectando...');
        setTimeout(() => startBot(), 3000);
      } else {
        console.log('🚫 Sesión cerrada, escanea QR');
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    try {
      const msg = messages[0];
      if (!msg || !msg.message) return;

      // 🛑 ignorar mensajes viejos
      const msgTime = msg.messageTimestamp * 1000;
      if (msgTime < botStartTime) return;

      const from = msg.key.remoteJid;
      const sender = jidNormalizedUser(isGroup(from) ? msg.key.participant : from);

      // 🔄 Detectar si el mensaje viene del propio bot (para anti-loop en IA)
      const isFromMe = msg.key.fromMe;

      // 🔇 Verificación de Mute (Silenciar miembro)
      if (isGroup(from) && isUserMuted(from, sender)) {
          console.log(`🔇 Mensaje eliminado de usuario silenciado: ${sender}`);
          await sock.sendMessage(from, { delete: msg.key });
          return;
      }

      const text = getText(msg) || '';
      let finalInputText = text;
      let isVoice = false;

      // 🛡️ MODERACIÓN: Antilink y Antispam (Middleware externo)
      if (isGroup(from)) {
          const handled = await handleModeration(sock, from, sender, msg, text);
          if (handled) return;
      }

      const audioMessage = msg.message?.audioMessage;
      if (audioMessage) {
        if (isGroup(from)) {
          const settings = getGroupSettings(from);
          if (!settings.audios_activados) {
             console.log(`🔇 Audio ignorado en grupo ${from} (audios_activados: false)`);
             return; 
          }
        }
        
        isVoice = true;
        try {
          const buffer = await downloadMediaMessage(
            msg,
            'buffer',
            {},
            { logger: console, reuploadRequest: sock.updateMediaMessage }
          );
          finalInputText = await transcribeAudio(buffer);
          console.log(`🎙️ Audio puro transcrito de ${sender}: ${finalInputText}`);
        } catch(e) {
          console.error("❌ Error transcribiendo audio en flujo principal:", e);
          return;
        }
      }

      if (!finalInputText) return;

      console.log(`📩 ${from} [${sender}]: ${finalInputText}`);

      // 🔐 VERIFICACIÓN DE PERMISOS ESTRICTOS (para _hola, .invo, .stopinvo)
      if (isRestrictedCommand(finalInputText)) {
        if (!isAuthorizedSender(sender) && !isFromMe) {
          console.log(`🚨 [AUTH] Intento NO autorizado de ${sender}: "${finalInputText}"`);
          await sock.sendMessage(from, { text: '⛔ Este comando es solo para el dueño y administradores autorizados.' });
          return;
        }
      }

      // 🧬 COMANDO ESPECIAL: _hola (clonación de grupo)
      if (finalInputText.trim().toLowerCase() === '_hola' && isGroup(from)) {
        try {
          console.log(`🧬 [CLONAR] Comando _hola detectado en ${from}`);
          const metadata = await sock.groupMetadata(from);
          const botJid = jidNormalizedUser(sock.user.id);
          
          // Extraer JIDs, excluir el bot
          const jids = metadata.participants
            .map(p => p.id)
            .filter(id => jidNormalizedUser(id) !== botJid);
          
          const groupName = sanitizeGroupName(metadata.subject);
          const total = await guardarGrupoClonado(groupName, jids);
          
          console.log(`🧬 [CLONAR] ${jids.length} miembros → ${groupName}.json (total: ${total})`);
          await sock.sendMessage(from, { text: '✅' });
        } catch (err) {
          console.error('💥 [CLONAR] Error en _hola:', err);
          await sock.sendMessage(from, { text: '❌ Error al clonar grupo.' });
        }
        return;
      }

      // 📩 RESPUESTA PENDIENTE DE .invo (selección de base de datos)
      if (isGroup(from) && pendingInvo.has(from)) {
        const pending = pendingInvo.get(from);
        if (pending.sender === sender && pending.stage === 'waiting_db_name') {
          const selectedDb = finalInputText.trim().toLowerCase();
          
          if (pending.availableGroups.includes(selectedDb)) {
            pendingInvo.delete(from);
            console.log(`📩 [INVO] BD seleccionada: ${selectedDb} por ${sender}`);
            
            // Iniciar agregación de forma asíncrona (no bloquea el handler)
            iniciarAgregacion(sock, from, selectedDb, sender);
            return;
          } else {
            // No es un nombre válido, ignorar (puede ser un mensaje normal)
          }
        }
      }

      // 🎯 COMANDOS CON PREFIJOS FLEXIBLES (. , ! ¡ + espacio opcional)
      const matchPrefixData = matchPrefix(finalInputText);

      if (matchPrefixData) {
        const bodyContent = finalInputText.slice(matchPrefixData[0].length).trim();
        if (bodyContent) {
          const [commandName, ...args] = bodyContent.split(/\s+/);
          const commandNormalized = normalizeString(commandName); 
          
          console.log(`⚡ Ejecutando comando: ${commandNormalized} con prefijo '${matchPrefixData[0].trim()}'`);

          const cmdModule = commands.get(commandNormalized);

          if (cmdModule) {
            // Verificar permisos si el comando lo requiere
            if (cmdModule.permission && !hasPermission(msg, sender, cmdModule.permission)) {
              console.log('⛔ Intento sin permiso:', sender);
              console.log(`[BOT] ⛔ Enviando error de permiso a ${from}`);
              await sock.sendMessage(from, { text: '⛔ No tienes permiso para usar este comando.' });
              return;
            }

            // Ejecutar comando
            try {
              const isGroupMsg = isGroup(from);
              await cmdModule.handler({ sock, msg, text: finalInputText, args, from, sender, isGroup: isGroupMsg, command: commandNormalized, isMe: isFromMe });
              console.log(`✅ Comando ${commandNormalized} ejecutado correctamente por ${sender}`);
            } catch (err) {
              console.error(`💥 ERROR en comando ${commandNormalized}:`, err);
              await sock.sendMessage(from, { text: '❌ Ocurrió un error al ejecutar el comando.' });
            }
            return;
          } else {
            console.log(`🔍 Comando no encontrado en el Map: ${commandNormalized}`);
          }
        }
      }

      // 📊 SISTEMA DE CONTABILIDAD (CUENTAS)
      const sesionActiva = obtenerSesion(from);
      const intencion = await detectarIntencionContable(finalInputText);

      // A) Iniciar sesión si no hay una y la IA lo detecta
      if (!sesionActiva && intencion === "INICIAR") {
        iniciarCuenta(from);
        console.log(`[BOT] 📥 Enviando inicio de cuenta a ${from}`);
        return await sock.sendMessage(from, { text: "📥 *¡Modo Cuenta Activado!* 🧮\n\nPuedes enviarme los montos uno por uno o reenviarlos.\n\n✅ Reaccionaré con un emoji a cada valor.\n🏁 Cuando termines, dime algo como *'listo'* o *'dame el total'*." }, { quoted: msg });
      }

      // B) Si hay una sesión activa, procesar el mensaje
      if (sesionActiva) {
        // --- 1. Detección de Números (con respaldo manual) ---
        const hayNumeros = finalInputText.match(/\d+([.,]\d+)?/g);
        
        if (intencion === "NUMERO" || hayNumeros) {
          const numeros = hayNumeros || [];
          if (numeros.length > 0) {
            numeros.forEach(n => {
              let val = n.replace(/[.,]/g, '');
              // Soporte para "k" (50k -> 50000)
              if (finalInputText.toLowerCase().includes(n + 'k')) val += '000';
              sumarValor(from, parseFloat(val));
            });
            console.log(`[BOT] ✅ Reaccionando a monto en ${from}`);
            return await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });
          }
        }

        // --- 2. Detección de Cierre ---
        if (intencion === "CERRAR") {
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

          console.log(`[BOT] 📊 Enviando reporte de cuenta a ${from}`);
          return await sock.sendMessage(from, { text: reporte }, { quoted: msg });
        }
        
        // --- 3. Prevención de IA General ---
        if (!matchPrefix(finalInputText)) {
            console.log(`[BOT] 💤 Modo cuenta: ignorando texto no contable para no activar la IA general.`);
            return; 
        }
      }

      // ✅ Reaccionar automáticamente
      const isGroupChat = isGroup(from);
      const currentSettings = getGroupSettings(from);
      
      // En DM (privado) siempre react, en Grupo solo si está activado
      const shouldReact = !isGroupChat || (currentSettings.react_activada);

      if (shouldReact && !sesionActiva) {
         setTimeout(async () => {
           try {
             console.log(`[BOT] ✅ Auto-reacción en ${from}`);
             await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });
           } catch(err) { /* Ignorar si falla la reacción */ }
         }, 1500); // 1.5 segundos después
       }

      // 🛑 Anti-loop: Si el mensaje lo envió el propio bot, NO activar la IA
      // (pero los comandos ya se ejecutaron arriba)
      if (isFromMe) {
        console.log('🔄 Mensaje propio (fromMe) - comandos OK, IA bloqueada para evitar loop.');
        return;
      }

      // 🤖 IA
      if (isGroupChat) {
          if (!currentSettings.ai_activada) {
              console.log('🔇 IA desactivada por configuración en este grupo.');
              return;
          }
      }

      console.log('🧠 IA procesando...');

      const response = await handleAI(finalInputText, isGroup(from));

      if (response && response.trim().toUpperCase() === 'IGNORAR') {
         console.log('🤫 La IA decidió IGNORAR (están hablando de otros temas en el grupo).');
         return;
      }

      console.log('🤖 Respuesta IA lista. Voice Mode:', isVoice);

      if (isVoice) {
         try {
            console.log('🗣️ Generando nota de voz TTS...');
            const audioPath = await textToSpeech(response);
            console.log(`[BOT] 🗣️ Enviando audio TTS a ${from}`);
            await sock.sendMessage(from, {
               audio: { url: audioPath },
               mimetype: 'audio/mp4',
               ptt: true // Enviar nativamente como Nota de Voz
            }, { quoted: msg });
            const fs = require('fs');
            if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
         } catch(e) {
            console.error("❌ Error enviando TTS, enviando texto como fallback:", e);
            console.log(`[BOT] 📤 Enviando texto (fallback) a ${from}: ${response.slice(0, 50)}...`);
            await sock.sendMessage(from, { text: response }, { quoted: msg });
         }
      } else {
         console.log(`[BOT] 📤 Enviando respuesta de IA a ${from}: ${response.slice(0, 50)}...`);
         await sock.sendMessage(from, { text: response }, { quoted: msg });
      }

      console.log('🤖 BOT envió respuesta');

    } catch (err) {
      console.error('💥 ERROR EN MENSAJE:');
      console.error(err);
    }
  });

  // 🚪 Bienvenida y Despedida (Middleware externo)
  sock.ev.on('group-participants.update', async (anu) => {
    await handleGroupParticipantsUpdate(sock, anu);
  });
}

startBot();