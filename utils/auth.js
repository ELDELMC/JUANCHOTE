/**
 * 🔐 SISTEMA DE PERMISOS ESTRICTOS
 * Controla quién puede usar los comandos sensibles:
 * _hola, .invo, .stopinvo
 * 
 * Los JIDs autorizados se cargan desde ./db/allowed_users.json
 * Si el archivo no existe, se crea con la lista inicial hardcodeada.
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { jidNormalizedUser } = require('@whiskeysockets/baileys');

const AUTH_FILE = path.join(__dirname, '..', 'db', 'allowed_users.json');

// 🔒 Lista hardcodeada de fallback (nunca se pierde acceso)
const HARDCODED_JIDS = [
  '573218950565@s.whatsapp.net', // Bot
  '573052274793@s.whatsapp.net', // Dueño
  '573188774061@s.whatsapp.net'  // Admin de confianza
];

// 🗺️ Set global de usuarios autorizados
let allowedUsers = new Set(HARDCODED_JIDS);

/**
 * Asegura que la carpeta db/ y el archivo existan
 */
async function ensureAuthFile() {
  const dir = path.dirname(AUTH_FILE);
  await fsp.mkdir(dir, { recursive: true });

  if (!fs.existsSync(AUTH_FILE)) {
    const initial = { allowedJIDs: [...HARDCODED_JIDS] };
    await fsp.writeFile(AUTH_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    console.log('🔐 [AUTH] Archivo allowed_users.json creado con lista inicial.');
  }
}

/**
 * Carga los JIDs autorizados desde el archivo JSON al Set global.
 * Si hay error, usa la lista hardcodeada como fallback.
 */
async function cargarUsuariosAutorizados() {
  try {
    await ensureAuthFile();
    const raw = await fsp.readFile(AUTH_FILE, 'utf-8');
    const data = JSON.parse(raw);

    if (data.allowedJIDs && Array.isArray(data.allowedJIDs) && data.allowedJIDs.length > 0) {
      // Siempre incluir los hardcodeados + los del archivo
      allowedUsers = new Set([...HARDCODED_JIDS, ...data.allowedJIDs]);
      console.log(`🔐 [AUTH] ${allowedUsers.size} usuarios autorizados cargados.`);
    } else {
      allowedUsers = new Set(HARDCODED_JIDS);
      console.log('🔐 [AUTH] Archivo vacío, usando lista hardcodeada.');
    }
  } catch (err) {
    console.error('❌ [AUTH] Error leyendo allowed_users.json, usando fallback:', err.message);
    allowedUsers = new Set(HARDCODED_JIDS);
  }
}

/**
 * Verifica si un JID está autorizado para usar comandos sensibles.
 * @param {string} jid - JID del remitente (con o sin @s.whatsapp.net)
 * @returns {boolean}
 */
function isAuthorizedSender(jid) {
  if (!jid) return false;
  // Normalizar: si no tiene @, agregar @s.whatsapp.net
  const normalized = jid.includes('@') ? jidNormalizedUser(jid) : `${jid}@s.whatsapp.net`;
  return allowedUsers.has(normalized);
}

/**
 * Recarga el archivo JSON y actualiza el Set en tiempo real.
 * Se usa con el comando oculto .reloadperms
 */
async function recargarPermisos() {
  await cargarUsuariosAutorizados();
  return allowedUsers.size;
}

// Comandos que requieren autorización estricta
const RESTRICTED_COMMANDS = ['_hola', 'invo', 'invocar', 'agregar', 'stopinvo', 'pararinvo', 'stopinvocacion'];

/**
 * Verifica si un texto de comando está restringido
 */
function isRestrictedCommand(text) {
  if (!text) return false;
  const lower = text.trim().toLowerCase();
  
  // Caso especial: _hola (sin prefijo)
  if (lower === '_hola') return true;
  
  // Comandos con prefijo: extraer el nombre
  const prefixMatch = lower.match(/^[.,!]\s?(.+)/);
  if (prefixMatch) {
    const cmdName = prefixMatch[1].split(/\s+/)[0];
    return RESTRICTED_COMMANDS.includes(cmdName);
  }
  
  return false;
}

module.exports = {
  cargarUsuariosAutorizados,
  isAuthorizedSender,
  recargarPermisos,
  isRestrictedCommand,
  RESTRICTED_COMMANDS
};
