const { jidNormalizedUser } = require('@whiskeysockets/baileys');

function getText(msg) {
  return msg.message?.conversation ||
         msg.message?.extendedTextMessage?.text ||
         msg.message?.imageMessage?.caption ||
         '';
}

function isGroup(jid) {
  return jid ? jid.endsWith('@g.us') : false;
}

/**
 * 🛠️ Eliminar tildes y normalizar para comandos uniformes
 */
function normalizeString(str) {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/**
 * 🛡️ Verificación de administrador (con soporte para metadata manual y dualidad LID/JID)
 */
function checkAdmin(participants, jid) {
  if (!jid || !participants) return false;
  
  const normalizedJid = jidNormalizedUser(jid);
  const userPrefix = normalizedJid.split('@')[0];

  const p = participants.find(part => {
    const pNormalized = jidNormalizedUser(part.id);
    // Coincidencia exacta (formato normalizado)
    if (pNormalized === normalizedJid) return true;
    
    // Coincidencia por "número/prefijo" si uno es LID y otro JID
    // Solo si el prefijo es largo (para evitar falsos positivos con IDs cortos si existen)
    if (userPrefix.length > 5 && pNormalized.startsWith(userPrefix + '@')) return true;
    
    return false;
  });

  return !!p?.admin;
}

/**
 * 🛡️ Verificación dinámica de admin (obtiene metadata si no se provee)
 */
async function getIsAdmin(sock, from, jid) {
    try {
        const metadata = await sock.groupMetadata(from);
        return checkAdmin(metadata.participants, jid);
    } catch (e) {
        return false;
    }
}

module.exports = { getText, isGroup, normalizeString, checkAdmin, getIsAdmin };