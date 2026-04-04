module.exports = {
  command: ['enlace', 'link', 'invitacion'],
  handler: async ({ sock, from, isGroup }) => {
    if (!isGroup) return await sock.sendMessage(from, { text: '❌ Este comando es exclusivo para grupos.' });

    try {
      const code = await sock.groupInviteCode(from);
      await sock.sendMessage(from, { text: `🔗 *LINK DE INVITACIÓN* 🔗\n\nhttps://chat.whatsapp.com/${code}` });
    } catch (e) {
      console.error(e);
      await sock.sendMessage(from, { text: '❌ Error: ¿El bot es administrador?' });
    }
  }
};
