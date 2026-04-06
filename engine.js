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

// Estos se cargan dinámicamente para evitar circularidad
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
  
  if (isMain) {
    accounts.limpiarTodasLasCuentas();
    auth.cargarUsuariosAutorizados();
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionName);
  const { version } = await fetchLatestBaileysVersion();

  if (isMain) console.log(`📡 Conectando MAIN v${version.join('.')}`);

  const sock = makeWASocket({
    auth: state,
    version,
    logger: P({ level: 'silent' }),
    browser: ['Mac OS', 'Chrome', '121.0.6167.184'], // Browser más estable para evitar 405
    printQRInTerminal: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      console.log(`\n📱 [QR] ESCANEA PARA: ${sessionName.toUpperCase()}`);
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      console.log(`✅ BOT CONECTADO: ${sessionName}`);
      botManager.addBot(sessionName, sock);
    }

    if (connection === 'close') {
      const error = lastDisconnect?.error;
      botManager.removeBot(sessionName);
      const statusCode = error?.output?.statusCode;
      if (statusCode !== DisconnectReason.loggedOut) {
        console.log(`🔄 Reconectando ${sessionName}...`);
        setTimeout(() => startBot(sessionName, isMain), 3000);
      } else {
        console.log(`🚫 Sesión cerrada en ${sessionName}`);
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    if (!isMain) return; // Esclavos no procesan comandos ni IA
    try {
      const msg = messages[0];
      if (!msg || !msg.message) return;
      if (msg.messageTimestamp * 1000 < botStartTime) return;

      const from = msg.key.remoteJid;
      const rawParticipant = helpers.isGroup(from) ? (msg.key.participantAlt || msg.key.participant) : from;
      const sender = jidNormalizedUser(rawParticipant);
      const isFromMe = msg.key.fromMe;

      // 🕵️ Spy Mode
      if (helpers.isGroup(from) && !isFromMe) {
          spyMode.processSpyMessage(sock, from, sender).catch(() => {});
      }

      // 🔇 Mute
      if (helpers.isGroup(from) && mute.isUserMuted(from, sender)) {
          await sock.sendMessage(from, { delete: msg.key });
          return;
      }

      const text = helpers.getText(msg) || '';
      let finalInputText = text;

      // 🛡️ Moderación
      if (helpers.isGroup(from)) {
          if (await moderation.handleModeration(sock, from, sender, msg, text)) return;
      }

      // 🎙️/📸 Media logic...
      const audioMessage = msg.message?.audioMessage;
      const imageMessage = msg.message?.imageMessage;
      let isVoice = false;

      if (imageMessage && helpers.isGroup(from)) {
          const s = settings.getGroupSettings(from);
          if (s.ai_activada) {
            try {
              const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: P({level:'silent'}), reuploadRequest: sock.updateMediaMessage });
              const desc = await vision.describeImage(buffer, imageMessage.mimetype || "image/jpeg");
              if (desc) finalInputText += `\n[Imagen: ${desc}]`;
            } catch (e) {}
          }
      }

      if (audioMessage) {
        if (helpers.isGroup(from) && !settings.getGroupSettings(from).audios_activados) return;
        isVoice = true;
        try {
          const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: P({level:'silent'}), reuploadRequest: sock.updateMediaMessage });
          finalInputText = await audio.transcribeAudio(buffer);
        } catch(e) { return; }
      }

      if (!finalInputText) return;
      memory.saveMessage(from, sender, finalInputText, false);

      // 🔐 Permisos
      const isJijijija = finalInputText.trim().toLowerCase().startsWith('jijijija');
      if (auth.isRestrictedCommand(finalInputText) || isJijijija) {
        if (!auth.isAuthorizedSender(sender) && !isFromMe) return;
      }

      // 🧬 _hola
      if (finalInputText.trim().toLowerCase() === '_hola' && helpers.isGroup(from)) {
          const meta = await sock.groupMetadata(from);
          const jids = meta.participants.map(p => p.id).filter(id => jidNormalizedUser(id) !== jidNormalizedUser(sock.user.id));
          const gName = clonador.sanitizeGroupName(meta.subject);
          await clonador.guardarGrupoClonado(gName, jids);
          await sock.sendMessage(from, { text: '✅ Base actualizada.' });
          return;
      }

      // 🎯 Comandos
      const prefixData = helpers.matchPrefix(finalInputText);
      if (prefixData || isJijijija) {
        const body = isJijijija ? finalInputText : finalInputText.slice(prefixData[0].length).trim();
        const [cmdName, ...args] = body.split(/\s+/);
        const cmd = commands.get(helpers.normalizeString(isJijijija ? 'jijijija' : cmdName));
        if (cmd) {
          await cmd.handler({ sock, msg, text: finalInputText, args, from, sender, isGroup: helpers.isGroup(from), command: cmdName, isMe: isFromMe });
          return;
        }
      }

      // (Lógica de contabilidad y AI omitida aquí por brevedad, sigue igual en el flujo principal)
      // Pero por ahora, iniciemos el bot para verificar conexión
      console.log(`📩 ${from}: ${finalInputText}`);
      
      // Responder con IA...
      const currentSettings = settings.getGroupSettings(from);
      if (!helpers.isGroup(from) || currentSettings.ai_activada) {
         const response = await ai.askAI(finalInputText, helpers.isGroup(from), from, sender);
         if (response && response.toUpperCase() !== 'IGNORAR') {
            if (isVoice) {
               const audioPath = await audio.textToSpeech(response);
               await sock.sendMessage(from, { audio: { url: audioPath }, mimetype: 'audio/mp4', ptt: true }, { quoted: msg });
               if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
            } else {
               await sock.sendMessage(from, { text: response }, { quoted: msg });
            }
         }
      }

    } catch (err) { console.error('Error message:', err); }
  });

  sock.ev.on('group-participants.update', async (anu) => {
    if (isMain) await groupEvents.handleGroupParticipantsUpdate(sock, anu);
  });

  return sock;
}

module.exports = { startBot, setCommands };
