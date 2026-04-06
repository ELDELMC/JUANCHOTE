const { startBot } = require('../engine');
const { sendStyledMessage } = require('../utils/styles');

module.exports = {
  command: ['addbot', 'adbot', 'nuevobot'],
  permission: 'admin',
  handler: async ({ sock, from }) => {
    // Generar un nombre de sesión único
    const sessionName = 'auth_sub_' + Date.now();
    
    await sendStyledMessage(sock, from, "𝙽𝚞𝚎𝚟𝚘 𝙱𝚘𝚝 𝙸𝚗𝚒𝚌𝚒𝚊𝚍𝚘", 
      `Iniciando una nueva sesión esclava: *${sessionName}*\n\n` +
      `🌐 *REVISA LA CONSOLA (Terminal)* en Pterodactyl/BoxMine.\n` +
      `Aparecerá un nuevo código QR. Escanéalo con el SEGUNDO dispositivo de WhatsApp que quieras conectar.\n\n` +
      `⚠️ IMPORTANTE: No escanees con el número que ya está usando este bot principal.`
    );

    // Iniciar con isMain en FALSE para que funcione solo como esclavo de invocación
    startBot(sessionName, false);
  }
};
