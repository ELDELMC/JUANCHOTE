const { isAuthorizedSender } = require('../utils/auth');
const { checkAdmin } = require('../utils/helpers');

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

        let menu = `📊 *TABLA DE COMANDOS JUANCHOTE* 📊\n\n`;

        // 👑 SECCIÓN CREADOR
        menu += `👑 *COMANDOS PARA CREADOR:*\n`;
        menu += `> _Tiene acceso a TODOS los comandos existentes._\n`;
        menu += `• *.invo* - Iniciar invocación masiva.\n`;
        menu += `• *.stopinvo* - Detener invocación.\n`;
        menu += `• *.reloadperms* - Recargar lista de autorizados.\n\n`;

        // 🛡️ SECCIÓN ADMINS
        if (isAdmin || !isGroup) {
            menu += `🛡️ *ADMINISTRACIÓN DE GRUPOS:*\n`;
            menu += `• *.admin* - Panel de control (kick, promote, mute, etc).\n`;
            menu += `• *.ai on/off* - Activar/Desactivar IA en el grupo.\n`;
            menu += `• *.react on/off* - Activar/Desactivar reacciones ✅.\n`;
            menu += `• *.antilink on/off* - Bloquear enlaces de WhatsApp.\n`;
            menu += `• *.antispam on/off* - Controlar flujo de mensajes.\n`;
            menu += `• *.mute [tiempo]* - Silenciar a un usuario temporalmente.\n`;
            menu += `• *.advertir* - Dar un aviso a un miembro (3 = expulsor).\n`;
            menu += `• *.mencionar* - Etiquetar a todos los miembros.\n`;
            menu += `• *.setbienvenida* - Configurar mensaje de entrada.\n`;
            menu += `• *.setdespedida* - Configurar mensaje de salida.\n`;
            menu += `• *.setreglas* - Establecer normas del grupo.\n\n`;
        }

        // 🤝 SECCIÓN HELPERS
        menu += `🤝 *HELPERS:*\n`;
        menu += `> _Próximamente..._\n\n`;

        // 👤 SECCIÓN USUARIOS
        menu += `👤 *COMANDOS PARA USUARIOS:*\n`;
        menu += `• *.cuenta* - Iniciar contabilidad de gastos/ventas.\n`;
        menu += `• *.sticker* - Convertir imagen/video en sticker.\n`;
        menu += `• *.ia [pregunta]* - Consultar algo a la IA directamente.\n`;
        menu += `• *.wiki [tema]* - Buscar información en Wikipedia.\n`;
        menu += `• *.dado / .moneda* - Juegos de azar.\n`;
        menu += `• *.suerte* - Recibir una predicción diaria.\n`;
        menu += `• *.transcribir* - Convertir audio a texto (responder a audio).\n`;
        menu += `• *.info* - Ver información del bot y el grupo.\n`;
        menu += `• *.reglas* - Leer las normas del grupo actual.\n`;
        menu += `• *.ping* - Verificar latencia del bot.\n\n`;

        menu += `💡 *Tip:* Puedes usar tanto *.* como *!* (ej: !tabla). También puedes poner un espacio después del punto.`;

        await sock.sendMessage(from, { text: menu }, { quoted: msg });
    }
};
