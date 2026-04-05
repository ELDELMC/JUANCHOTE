const { checkAdmin } = require('../utils/helpers');

module.exports = {
  command: ['mencionar', 'todos', 'tagall', 'hidetag'],
  handler: async ({ sock, msg, from, sender, args, isGroup, isMe }) => {
    if (!isGroup) return await sock.sendMessage(from, { text: '❌ Este comando es exclusivo para grupos.' });

    try {
      const metadata = await sock.groupMetadata(from);
      const { isAuthorizedSender } = require('../utils/auth');
      const isAdmin = checkAdmin(metadata.participants, sender) || isMe || isAuthorizedSender(sender);
      
      // Limitar !todos a admins para evitar spam
      if (!isAdmin) return await sock.sendMessage(from, { text: '❌ Solo los administradores pueden convocar a todos.' });

      const text = args.join(' ') || '¡Atención a todos!';
      const participants = metadata.participants.map(p => p.id);

      await sock.sendMessage(from, { 
        text: `📢 *AVISO GRUPAL* 📢\n\n${text}`, 
        mentions: participants 
      });
    } catch (e) {
      console.error(e);
    }
  }
};
