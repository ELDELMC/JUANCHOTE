const { isAuthorizedSender } = require('../utils/auth');
const { checkAdmin } = require('../utils/helpers');
const { sendStyledMessage } = require('../utils/styles');

module.exports = {
    command: ['tabla', 'comandos', 'help', 'ayuda'],
    description: 'Muestra la tabla de comandos categorizada por permisos.',
    handler: async ({ sock, from, sender, isGroup, msg }) => {
        const isOwner = isAuthorizedSender(sender);
        let isAdmin = false;

        if (isGroup) {
            const metadata = await sock.groupMetadata(from);
            isAdmin = checkAdmin(metadata.participants, sender) || isOwner;
        } else {
            isAdmin = isOwner; // En DM, el dueño es admin de sí mismo
        }

        let menu = ``;

        // 👑 SECCIÓN CREADOR
        menu += `👑 𝙲𝙾𝙼𝙰𝙽𝙳𝙾𝚂 𝙿𝙰𝚁𝙰 𝙲𝚁𝙴𝙰𝙳𝙾𝚁\n`;
        menu += `Tiene acceso a TODOS los comandos existentes.\n`;
        menu += `• .invo - Iniciar invocación masiva.\n`;
        menu += `• .stopinvo - Detener invocación.\n`;
        menu += `• .reloadperms - Recargar lista de autorizados.\n\n`;

        // 🛡️ SECCIÓN ADMINS
        if (isAdmin || !isGroup) {
            menu += `🛡️ 𝙰𝙳𝙼𝙸𝙽𝙸𝚂𝚃𝚁𝙰𝙲𝙸𝙾𝙽 𝙳𝙴 𝙶𝚁𝚄𝙿𝙾𝚂\n`;
            menu += `• .admin - Panel de control.\n`;
            menu += `• .ai on/off - Activar/Desactivar IA.\n`;
            menu += `• .react on/off - Activar/Desactivar reacciones.\n`;
            menu += `• .antilink on/off - Bloquear enlaces.\n`;
            menu += `• .antispam on/off - Controlar spam.\n`;
            menu += `• .mute [tiempo] - Silenciar temporalmente.\n`;
            menu += `• .advertir - Dar aviso a miembro.\n`;
            menu += `• .mencionar - Etiquetar a todos.\n`;
            menu += `• .setbienvenida - Mensaje de entrada.\n`;
            menu += `• .setdespedida - Mensaje de salida.\n`;
            menu += `• .setreglas - Establecer normas.\n\n`;
        }

        // 🤝 SECCIÓN HELPERS
        menu += `🤝 𝙷𝙴𝙻𝙿𝙴𝚁𝚂\n`;
        menu += `Próximamente...\n\n`;

        // 👤 SECCIÓN USUARIOS
        menu += `👤 𝙲𝙾𝙼𝙰𝙽𝙳𝙾𝚂 𝙿𝙰𝚁𝙰 𝚄𝚂𝚄𝙰𝚁𝙸𝙾𝚂\n`;
        menu += `• .cuenta - Contabilidad de montos.\n`;
        menu += `• .sticker - Convertir a sticker.\n`;
        menu += `• .ia [msg] - Consultar a la IA.\n`;
        menu += `• .wiki [tema] - Buscar en Wikipedia.\n`;
        menu += `• .dado / .moneda - Juegos de azar.\n`;
        menu += `• .suerte - Predicción diaria.\n`;
        menu += `• .transcribir - Convertir audio a texto.\n`;
        menu += `• .info - Información del bot y grupo.\n`;
        menu += `• .reglas - Leer normas actuales.\n`;
        menu += `• .ping - Latencia del bot.\n\n`;

        menu += `Tip: Puedes usar "." o "!" (ej: !tabla).`;

        await sendStyledMessage(sock, from, "𝚃𝙰𝙱𝙻𝙰 𝙳𝙴 𝙲𝙾𝙼𝙰𝙽𝙳𝙾𝚂", menu, msg);
    }
};
