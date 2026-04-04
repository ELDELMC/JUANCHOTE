const { checkAdmin } = require('../utils/helpers');

module.exports = {
  command: ['ayuda', 'help'],
  handler: async ({ sock, from, sender, isGroup }) => {
    let name = 'Grupo';
    let isAdmin = false;

    if (isGroup) {
      try {
        const metadata = await sock.groupMetadata(from);
        name = metadata.subject;
        isAdmin = checkAdmin(metadata.participants, sender);
      } catch (e) {
        console.error('❌ Error obteniendo metadata para ayuda:', e);
      }
    }

    try {
      let menu = `🤖 *COMANDOS JUANCHOTE BOT* 🤖\n\n`;
      
      menu += `🌟 *Útiles para todos (Grupos y Privado):*\n`;
      menu += `- *!ayuda* : Muestra este menú.\n`;
      menu += `- *!reglas* : Ver normas del grupo.\n`;
      menu += `- *!enlace* : Link del grupo.\n`;
      menu += `- *!sticker* : Crear stickers (.s)\n`;
      menu += `- *!info* : Datos del grupo.\n`;
      menu += `- *!ia [texto]* : Hablar con la IA.\n`;
      menu += `- *!todos* : Mención masiva.\n\n`;

      if (isAdmin) {
        menu += `━━━━━━━━━━━━━━━\n`;
        menu += `👑 *Solo para Admins:*\n`;
        menu += `- *!setbienvenida [texto]* : Configurar bienvenida.\n`;
        menu += `- *!setdespedida [texto]* : Configurar despedida.\n`;
        menu += `- *!setreglas [texto]* : Cambiar reglas.\n`;
        menu += `- *!expulsar @user* : Kick (o responde).\n`;
        menu += `- *!advertir @user* : Dar strike (3 = kick).\n`;
        menu += `- *!antilink on/off* : Bloqueo de links.\n`;
        menu += `- *!antispam on/off* : Control de spam.\n`;
        menu += `- *!resetlink* : Nuevo link del grupo.\n`;
        menu += `- *!cuenta on/off* : Modo contabilidad.\n`;
        menu += `- *!ai on/off* : Toggle IA auto.\n`;
      }

      menu += `\n_Variables: @user (mención), @groupname (nombre)_`;

      await sock.sendMessage(from, { text: menu });
    } catch (e) {
      console.error(e);
      await sock.sendMessage(from, { text: '❌ Error al generar el menú.' });
    }
  }
};
