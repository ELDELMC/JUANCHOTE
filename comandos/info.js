module.exports = {
  command: ['info', 'infogrupo', 'stats'],
  handler: async ({ sock, from, isGroup, sender }) => {
    let info = '';

    if (isGroup) {
      try {
        const metadata = await sock.groupMetadata(from);
        const admins = metadata.participants.filter(p => !!p.admin).length;
        const creationDate = new Date(metadata.creation * 1000).toLocaleDateString('es-CO');
        const owner = metadata.owner || 'No detectado';

        info = `📋 *INFO DEL GRUPO* 📋\n\n` +
               `🏷️ *Nombre:* ${metadata.subject}\n` +
               `🆔 *ID:* ${metadata.id}\n` +
               `📆 *Creado:* ${creationDate}\n` +
               `👑 *Dueño:* @${owner.split('@')[0]}\n` +
               `👥 *Miembros:* ${metadata.participants.length}\n` +
               `👮 *Admins:* ${admins}\n\n` +
               `📝 *Descripción:* \n${metadata.desc || 'Sin descripción'}`;
        
        await sock.sendMessage(from, { text: info, mentions: [owner] });
      } catch (e) {
        console.error(e);
        await sock.sendMessage(from, { text: '❌ Error obteniendo info del grupo.' });
      }
    } else {
      info = `👤 *INFO DE USUARIO* 👤\n\n` +
             `🆔 *Tu ID:* ${sender.split('@')[0]}\n` +
             `📩 *Chat:* Privado\n\n` +
             `🤖 *Bot Name:* JUANCHOTE Bot\n` +
             `🔥 *Estado:* Funcionando correctamente.`;
      await sock.sendMessage(from, { text: info });
    }
  }
};
