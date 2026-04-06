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
    browser: ['Mac OS', 'Chrome', '121.0.6167.184'], 
    printQRInTerminal: false,
    generateHighQualityLinkPreview: true
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

      // Si es el principal, tratar de reanudar procesos de invitación pendientes
      if (isMain) {
        // Asegurar que la carpeta db existe
        const dbPath = path.join(__dirname, 'db');
        if (!fs.existsSync(dbPath)) fs.mkdirSync(dbPath);
        
        console.log('🔄 Buscando procesos de invitación para reanudar...');
        setTimeout(() => {
          invocador.resumeProcesses(sock).catch(e => console.error('Error reanudando:', e.message));
        }, 5000); // 5 seg de espera para que el socket esté listo
      }
    }

    if (connection === 'close') {
      const error = lastDisconnect?.error;
      botManager.removeBot(sessionName);
      const statusCode = error?.output?.statusCode;
      
      // Error 401 o LoggedOut significa que la sesión ya no sirve
      const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;

      if (isLoggedOut) {
        console.log(`🚫 La sesión [${sessionName}] ha vencido o fue cerrada.`);
        console.log(`🧹 Borrando carpeta ${sessionName} para generar nuevo QR...`);
        
        try {
          const sessionPath = path.join(__dirname, sessionName);
          if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, { recursive: true, force: true });
            console.log(`✅ Carpeta ${sessionName} eliminada.`);
          }
        } catch (e) {
          console.error(`❌ Error borrando carpeta:`, e.message);
        }

        // Reiniciar inmediatamente para que el usuario pueda ver el nuevo QR
        console.log(`🆕 Iniciando proceso de nuevo QR para ${sessionName}...`);
        setTimeout(() => startBot(sessionName, isMain), 1000);
      } else {
        // Reconexión por falla de red o servidor
        console.log(`🔄 Reconectando ${sessionName} (Causa: ${statusCode})...`);
        setTimeout(() => startBot(sessionName, isMain), 3000);
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    if (!isMain) return; 
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

      // 🔇 Mute (Borrado automático de silenciados)
      if (helpers.isGroup(from) && mute.isUserMuted(from, sender)) {
          const metadata = await sock.groupMetadata(from);
          const botJid = jidNormalizedUser(sock.user.id);
          const iAmAdmin = metadata.participants.some(p => jidNormalizedUser(p.id) === botJid && p.admin);

          if (iAmAdmin) {
              console.log(`🔇 [SHIELD] Mensaje borrado de usuario silenciado: ${sender} en ${from}`);
              await sock.sendMessage(from, { delete: msg.key });
          } else {
              console.warn(`📢 [SHIELD] No pude borrar mensaje de silenciado ${sender} porque NO SOY ADMIN.`);
          }
          return;
      }

      const text = helpers.getText(msg) || '';
      let finalInputText = text;

      // 🛡️ Moderación
      if (helpers.isGroup(from)) {
          if (await moderation.handleModeration(sock, from, sender, msg, text)) return;
      }

      // 🎙️/📸 Media logic
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

      // 📩 RESPUESTA PENDIENTE DE .invo (selección de base de datos)
      if (helpers.isGroup(from) && invocador.pendingInvo.has(from)) {
        const pending = invocador.pendingInvo.get(from);
        if (pending.sender === sender && pending.stage === 'waiting_db_name') {
            const rawContent = finalInputText.trim();
            const optionIndex = parseInt(rawContent) - 1;
            let selectedDb = null;

            if (!isNaN(optionIndex) && optionIndex >= 0 && optionIndex < pending.availableGroups.length) {
                selectedDb = pending.availableGroups[optionIndex];
            } else if (pending.availableGroups.includes(rawContent.toLowerCase())) {
                selectedDb = rawContent.toLowerCase();
            }

            if (selectedDb) {
                invocador.pendingInvo.delete(from);
                console.log(`📩 [INVO] BD seleccionada en engine: ${selectedDb}`);
                invocador.iniciarAgregacion(sock, from, selectedDb, sender);
                return;
            }
        }
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

      // 📊 SISTEMA DE CONTABILIDAD
      const sesionActiva = accounts.obtenerSesion(from);
      if (sesionActiva) {
          const intencion = await ai.detectarIntencionContable(finalInputText);
          const hayNumeros = finalInputText.match(/\d+([.,]\d+)?/g);

          if (intencion === "NUMERO" || hayNumeros) {
              const numeros = hayNumeros || [];
              if (numeros.length > 0) {
                  numeros.forEach(n => {
                      let val = n.replace(/[.,]/g, '');
                      if (finalInputText.toLowerCase().includes(n + 'k')) val += '000';
                      accounts.sumarValor(from, parseFloat(val));
                  });
                  await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });
                  return;
              }
          }

          if (intencion === "CERRAR") {
              const resultado = accounts.finalizarCuenta(from);
              const total = resultado.total;
              const f = (num) => new Intl.NumberFormat('es-CO').format(num);
              const reporte = `📊 *REPORTE FINAL* 📊\n\nTotal: $${f(total)}\n\n25% -> $${f(total*0.75)}\n30% -> $${f(total*0.70)}`;
              await styles.sendStyledMessage(sock, from, "𝚁𝚎𝚙𝚘𝚛𝚝𝚎 𝙵𝚒𝚗𝚊𝚕", reporte);
              return;
          }
          if (!prefixData) return; // En modo cuenta, si no es número ni cierre, ignoramos para no ensuciar con IA
      }

      console.log(`📩 ${from}: ${finalInputText}`);
      
      // Auto-Reacción
      if (!isFromMe && (!helpers.isGroup(from) || settings.getGroupSettings(from).react_activada)) {
          sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(()=>{});
      }

      // 🤖 Responder con IA
      const currentSettings = settings.getGroupSettings(from);
      if (!isFromMe && (!helpers.isGroup(from) || currentSettings.ai_activada)) {
         const response = await ai.askAI(finalInputText, helpers.isGroup(from), from, sender);
         if (response && response.toUpperCase() !== 'IGNORAR') {
            await sock.sendPresenceUpdate('composing', from);
            if (isVoice) {
               const audioPath = await audio.textToSpeech(response);
               await sock.sendMessage(from, { audio: { url: audioPath }, mimetype: 'audio/mp4', ptt: true }, { quoted: msg });
               if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
            } else {
               await sock.sendMessage(from, { text: response }, { quoted: msg });
            }
         }
      }

    } catch (err) { console.error('Error in loop:', err); }
  });

  sock.ev.on('group-participants.update', async (anu) => {
    if (isMain) await groupEvents.handleGroupParticipantsUpdate(sock, anu);
  });

  return sock;
}

module.exports = { startBot, setCommands };
