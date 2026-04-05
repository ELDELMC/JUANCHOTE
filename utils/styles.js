/**
 * ⸙𝙴𝙻𝙳𝙴𝙻_𝙼𝙲-𝙱𝙾𝚃⸙ - Sistema de Estilo Global
 * -----------------------------------------
 * Transforma texto normal a caracteres matemáticos monoespaciados (Fancy).
 */

const map = {
    'A': '𝙰', 'B': '𝙱', 'C': '𝙲', 'D': '𝙳', 'E': '𝙴', 'F': '𝙵', 'G': '𝙶', 'H': '𝙷', 'I': '𝙸', 'J': '𝙹', 'K': '𝙺', 'L': '𝙻', 'M': '𝙼', 'N': '𝙽', 'O': '𝙾', 'P': '𝙿', 'Q': '𝙺', 'R': '𝚁', 'S': '𝚂', 'T': '𝚃', 'U': '𝚄', 'V': '𝚅', 'W': '𝚆', 'X': '𝚇', 'Y': '𝚈', 'Z': '𝚉',
    'a': '𝚊', 'b': '𝚋', 'c': '𝚌', 'd': '𝚍', 'e': '𝚎', 'f': '𝚏', 'g': '𝚐', 'h': '𝚑', 'i': '𝚒', 'j': '𝚓', 'k': '𝚔', 'l': '𝚕', 'm': '𝚖', 'n': '𝚗', 'o': '𝚘', 'p': '𝚙', 'q': '𝚚', 'r': '𝚛', 's': '𝚜', 't': '𝚝', 'u': '𝚞', 'v': '𝚟', 'w': '𝚠', 'x': '𝚡', 'y': '𝚢', 'z': '𝚣',
    '0': '𝟶', '1': '𝟷', '2': '𝟸', '3': '𝟹', '4': '𝟺', '5': '𝟻', '6': '𝟼', '7': '𝟽', '8': '𝟾', '9': '𝟿'
};

/**
 * Convierte un texto a estilo Monospace (Fancy).
 */
function toFancyText(text) {
    if (!text) return "";
    return text.split('').map(char => map[char] || char).join('');
}

/**
 * Convierte un texto a MAYÚSCULAS y luego a estilo Monospace (Fancy).
 */
function toFancyUpper(text) {
    if (!text) return "";
    return toFancyText(text.toUpperCase());
}

/**
 * Envía un mensaje con el encabezado ⸙𝙴𝙻𝙳𝙴𝙻_𝙼𝙲-𝙱𝙾𝚃⸙ y bordes elegantes.
 * @param {import('@whiskeysockets/baileys').WASocket} sock 
 * @param {string} jid 
 * @param {string} title Título de la sección
 * @param {string} content Contenido del mensaje
 * @param {object} quoted Mensaje citado (opcional)
 */
async function sendStyledMessage(sock, jid, title, content, quoted = null) {
    const fancyTitle = toFancyUpper(title);
    const fancyContent = toFancyText(content);
    
    // Centrar título aproximado (ajustar si es necesario)
    const padding = " ".repeat(Math.max(0, Math.floor((36 - title.length) / 2)));
    
    const styledMessage = `⸙𝙴𝙻𝙳𝙴𝙻_𝙼𝙲-𝙱𝙾𝚃⸙\n\n` +
        `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮\n` +
        `┃${padding}${fancyTitle}${padding}┃\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
        `${fancyContent}\n\n` +
        `✦ 𝙴𝚗𝚟𝚒𝚊𝚍𝚘 𝚙𝚘𝚛 𝚎𝚕 𝚋𝚘𝚝 ✦`;

    return await sock.sendMessage(jid, { text: styledMessage }, { quoted });
}

module.exports = { toFancyText, toFancyUpper, sendStyledMessage };
