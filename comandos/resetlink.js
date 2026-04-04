const { checkAdmin } = require('../utils/helpers');

module.exports = {
  command: ['resetlink', 'revocar', 'newlink'],
  handler: async ({ sock, from, sender, isGroup }) => {
    if (!isGroup) return await sock.sendMessage(from, { text: '❌ Este comando es exclusivo para grupos.' });

    try {
      const metadata = await sock.groupMetadata(from);
      const isAdmin = checkAdmin(metadata.participants, sender);
      if (!isAdmin) return await sock.sendMessage(from, { text: '❌ Solo admins.' });

      await sock.groupRevokeInvite(from);
      const code = await sock.groupInviteCode(from);
      await sock.sendMessage(from, { text: `✅ *LINK ACTUALIZADO* 🔄\n\nNuevo link: https://chat.whatsapp.com/${code}` });
    } catch (e) {
      console.error(e);
      await sock.sendMessage(from, { text: '❌ Error: ¿Soy admin?' });
    }
  }
};
