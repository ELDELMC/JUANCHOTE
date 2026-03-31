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

      const text = getText(msg);
      if (!text) return;

      console.log(`📩 ${from} [${sender}]: ${text}`);

      // 🎯 COMANDOS
      if (text.startsWith('.')) {
        const [cmd, ...args] = text.slice(1).trim().split(/\s+/);
        const command = cmd.toLowerCase();

        console.log(`⚡ Ejecutando comando: ${command}`);

        const cmdModule = commands.get(command);

        if (cmdModule) {
          // Verificar permisos si el comando lo requiere
          if (cmdModule.permission && !hasPermission(msg, sender, cmdModule.permission)) {
            console.log('⛔ Intento sin permiso:', sender);
            await sock.sendMessage(from, { text: '⛔ No tienes permiso para usar este comando.' });
            return;
          }

          // Ejecutar comando
          try {
            await cmdModule.handler({ sock, msg, text, args, from, sender, isGroup, command });
          } catch (err) {
            console.error(`💥 ERROR en comando ${command}:`, err);
            await sock.sendMessage(from, { text: '❌ Ocurrió un error al ejecutar el comando.' });
          }
          return;
        } else {
          // Si el comando no existe, que no pase a IA
          return;
        }
      }

      // 🤖 IA
      console.log('🧠 IA procesando...');

      const response = await handleAI(text);

      console.log('🤖 Respuesta IA:', response);

      await sock.sendMessage(from, { text: response });

      console.log('🤖 BOT envió mensaje');

    } catch (err) {
      console.error('💥 ERROR EN MENSAJE:');
      console.error(err);
    }
  });
}

startBot();