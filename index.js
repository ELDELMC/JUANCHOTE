require('dotenv').config();

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require('@whiskeysockets/baileys');

const P = require('pino');
const qrcode = require('qrcode-terminal');

const { getText } = require('./utils/helpers');
const { hasPermission } = require('./utils/permissions');
const { askAI: handleAI } = require('./utils/ai');
const { transcribeAudio, textToSpeech } = require('./utils/audio');
const { getGroupSettings } = require('./utils/settings');
const { isUserMuted } = require('./utils/mute');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

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
      cmdModule.command.forEach(cmd => commands.set(cmd.toLowerCase(), cmdModule));
    } else {
      commands.set(cmdModule.command.toLowerCase(), cmdModule);
    }
  }
}

// Helper auxiliar para admin
const isGroup = (jid) => jid?.endsWith('@g.us');

let botStartTime = Date.now();

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: 'silent' }),
    browser: ['Mac OS', 'Chrome', '1.0.0'],
    version: [2, 3000, 1034074495]
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
      const sender = isGroup(from) ? msg.key.participant : from;

      // 🛑 anti loop
      if (msg.key.fromMe) return;

      // 🔇 Verificación de Mute (Silenciar miembro)
      if (isGroup(from) && isUserMuted(from, sender)) {
          console.log(`🔇 Mensaje eliminado de usuario silenciado: ${sender}`);
          await sock.sendMessage(from, { delete: msg.key });
          return;
      }

      const text = getText(msg) || '';
      let finalInputText = text;
      let isVoice = false;

      // 🎤 Interceptar y procesar audios
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

      // ✅ Reaccionar automáticamente a los mensajes de los grupos
      if (isGroup(from)) {
        setTimeout(async () => {
          try {
            await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });
          } catch(err) { /* Ignorar si falla la reacción */ }
        }, 2000); // 2 segundos después
      }

      // 🎯 COMANDOS CON PREFIJOS FLEXIBLES (. , ! + espacio opcional)
      const prefixRegex = /^[.,!]\s?/i;
      const matchPrefix = finalInputText.match(prefixRegex);

      if (matchPrefix) {
        const bodyContent = finalInputText.slice(matchPrefix[0].length).trim();
        if (bodyContent) {
          const [commandName, ...args] = bodyContent.split(/\s+/);
          const commandLowerCase = commandName.toLowerCase();

          console.log(`⚡ Ejecutando comando: ${commandLowerCase} con prefijo '${matchPrefix[0].trim()}'`);

          const cmdModule = commands.get(commandLowerCase);

          if (cmdModule) {
            // Verificar permisos si el comando lo requiere
            if (cmdModule.permission && !hasPermission(msg, sender, cmdModule.permission)) {
              console.log('⛔ Intento sin permiso:', sender);
              await sock.sendMessage(from, { text: '⛔ No tienes permiso para usar este comando.' });
              return;
            }

            // Ejecutar comando
            try {
              await cmdModule.handler({ sock, msg, text: finalInputText, args, from, sender, isGroup, command: commandLowerCase });
            } catch (err) {
              console.error(`💥 ERROR en comando ${commandLowerCase}:`, err);
              await sock.sendMessage(from, { text: '❌ Ocurrió un error al ejecutar el comando.' });
            }
            return;
          }
        }
      }

      // 🤖 IA
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
            await sock.sendMessage(from, {
               audio: { url: audioPath },
               mimetype: 'audio/mp4',
               ptt: true // Enviar nativamente como Nota de Voz
            }, { quoted: msg });
            const fs = require('fs');
            if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
         } catch(e) {
            console.error("❌ Error enviando TTS, enviando texto como fallback:", e);
            await sock.sendMessage(from, { text: response }, { quoted: msg });
         }
      } else {
         await sock.sendMessage(from, { text: response }, { quoted: msg });
      }

      console.log('🤖 BOT envió respuesta');

    } catch (err) {
      console.error('💥 ERROR EN MENSAJE:');
      console.error(err);
    }
  });
}

startBot();