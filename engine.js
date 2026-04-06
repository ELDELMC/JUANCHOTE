const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
  downloadMediaMessage
} = require('@whiskeysockets/baileys');
const P = require('pino');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// Cargados dinámicamente para evitar circularidad
let helpers, ai, audio, settings, accounts, memory, vision, clonador, invocador, auth, styles, moderation, groupEvents, spyMode, mute, botManager;

function initDeps() {
  helpers = require('./utils/helpers');
  ai = require('./utils/ai');
  audio = require('./utils/audio');
  settings = require('./utils/settings');
  accounts = require('./utils/accounts');
  memory = require('./utils/memory');
  vision = require('./utils/vision');
  clonador = require('./utils/clonador');
  invocador = require('./utils/invocador');
  auth = require('./utils/auth');
  styles = require('./utils/styles');
  moderation = require('./utils/moderation');
  groupEvents = require('./utils/groupEvents');
  spyMode = require('./utils/spyMode');
  mute = require('./utils/mute');
  botManager = require('./utils/botManager');
}

let commands = new Map();
let botStartTime = Date.now();

function setCommands(cmds) {
  commands = cmds;
}

async function startBot(sessionName = 'auth', isMain = true) {
  if (!helpers) initDeps();
  
  const { state, saveCreds } = await useMultiFileAuthState(sessionName);
  const { version, isLatest } = await fetchLatestBaileysVersion();

  if (isMain) console.log(`📡 Conectando MAIN v${version.join('.')} (Latest: ${isLatest})`);
  else console.log(`🔌 Cargando bot auxiliar: ${sessionName}`);

  const sock = makeWASocket({
    version,
    logger: P({ level: 'silent' }),
    printQRInTerminal: true,
    auth: state,
    browser: ["JuanChote Swarm", "Chrome", "1.0.0"],
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
    syncFullHistory: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr && !isMain) {
       console.log(`\n📲 ESCANEA ESTE CÓDIGO QR PARA EL BOT AUXILIAR [${sessionName}]:`);
       qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      console.log(`✅ BOT CONECTADO: ${sessionName}`);
      botManager.addBot(sessionName, sock);

      if (isMain) {
        const dbPath = path.join(__dirname, 'db');
        if (!fs.existsSync(dbPath)) fs.mkdirSync(dbPath);
        console.log('🔄 Buscando procesos de invitación para reanudar...');
        setTimeout(() => {
          invocador.resumeProcesses(sock).catch(e => console.error('Error reanudando:', e.message));
        }, 5000);
      }
    }

    if (connection === 'close') {
      const error = lastDisconnect?.error;
      botManager.removeBot(sessionName);
      const statusCode = error?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;

      if (isLoggedOut) {
        console.log(`🚫 La sesión [${sessionName}] ha vencido.`);
        try {
          const sessionPath = path.join(__dirname, sessionName);
          if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true });
        } catch (e) {}
        setTimeout(() => startBot(sessionName, isMain), 1000);
      } else {
        setTimeout(() => startBot(sessionName, isMain), 3000);
      }
    }
  });

  // 📥 MANEJADOR DE MENSAJES (SISTEMA DE ENJAMBRE)
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return; // Solo procesar mensajes nuevos reales

    try {
      const msg = messages[0];
      if (!msg || !msg.message) return;
      if (msg.key.remoteJid === 'status@broadcast') return;
      
      // Ignorar mensajes viejos antes del encendido
      const msgTime = msg.messageTimestamp * 1000;
      if (msgTime < botStartTime) return;

      const from = msg.key.remoteJid;
      const isGroup = from.endsWith('@g.us');
      const sender = jidNormalizedUser(isGroup ? (msg.key.participant || msg.key.participantAlt) : from);
      const isFromMe = msg.key.fromMe;

      if (!sender) return;

      // 🔇 ESCUDO DE SILENCIO (Ejecutado por CUALQUIER bot del enjambre)
      if (isGroup && !isFromMe && mute.isUserMuted(from, sender)) {
          try {
              await sock.sendMessage(from, { delete: msg.key });
              console.log(`🔇 [SHIELD-${sessionName}] Mensaje borrado de silenciado: ${sender}`);
              return; 
          } catch (e) {
              // Si falla, es probable que este bot no sea admin, pasamos.
          }
      }

      // --- DE AQUÍ EN ADELANTE SOLO RESPONDE EL BOT PRINCIPAL ---
      // Para evitar que todos los bots respondan al mismo comando
      if (!isMain) return;

      // 🕵️ Espionaje
      if (isGroup && !isFromMe) {
          spyMode.processSpyMessage(sock, from, sender).catch(() => {});
      }

      // Invocador (Pendientes de selección de BD)
      if (invocador.pendingInvo.has(sender) && isGroup) {
         const dbIndex = parseInt(helpers.getText(msg));
         if (!isNaN(dbIndex)) {
            const dbList = require('./utils/clonador').listarGruposClonadosSync();
            if (dbIndex > 0 && dbIndex <= dbList.length) {
               const selectedDb = dbList[dbIndex - 1];
               invocador.pendingInvo.delete(sender);
               console.log(`📩 [INVO] BD seleccionada en engine: ${selectedDb}`);
               invocador.iniciarAgregacion(sock, from, selectedDb, sender).catch(e => console.error(e));
               return; 
            }
         }
      }

      const text = helpers.getText(msg) || '';
      
      // IA MODO SPY (Aura contable)
      if (isGroup && !isFromMe && !text.startsWith('.')) {
          const auraType = await ai.detectarIntencionContable(text);
          if (auraType !== 'NADA') {
              console.log(`📊 [ACCOUNTING] Detectada intención: ${auraType}`);
              // Lógica de contabilidad aquí si fuera necesario
          }
      }

      // COMANDOS
      const prefix = /^[.!#]/.test(text) ? text[0] : null;
      if (prefix && !isFromMe) {
         const args = text.slice(1).trim().split(/ +/);
         const commandName = args.shift().toLowerCase();
         
         for (const [key, cmd] of commands.entries()) {
            if (cmd.command.includes(commandName)) {
               console.log(`📌 [COMANDO] ${prefix}${commandName} de ${sender}`);
               await cmd.handler({ sock, msg, args, from, sender, isGroup, isMe: isFromMe });
               return;
            }
         }
      }

      // IA RESPUESTA (Solo si se menciona al bot o en privado)
      const botNumber = jidNormalizedUser(sock.user.id).split('@')[0];
      const isMentioned = text.includes(`@${botNumber}`);
      const isPrivate = !isGroup;

      if ((isMentioned || isPrivate) && !isFromMe) {
         const response = await ai.askAI(text, isGroup, from, sender);
         if (response && response !== 'IGNORAR') {
             await sock.sendMessage(from, { text: response }, { quoted: msg });
         }
      }

    } catch (err) {
      console.error('💥 [MESSAGE_HANDLER_ERROR]:', err);
    }
  });

  return sock;
}

module.exports = { startBot, setCommands };
