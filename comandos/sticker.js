const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');

module.exports = {
  command: ['s', 'sticker'],
  handler: async ({ sock, msg, from }) => {
    try {
      // Find the media message
      const isQuoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const mediaMessage = isQuoted ? { message: isQuoted } : msg;
      
      const type = Object.keys(mediaMessage.message)[0];
      if (type !== 'imageMessage' && type !== 'videoMessage') {
        return await sock.sendMessage(from, { text: '❌ Envíame una imagen/video o responde a uno con .s' });
      }

      await sock.sendMessage(from, { text: '⏳ Creando sticker...' });

      const buffer = await downloadMediaMessage(
        mediaMessage,
        'buffer',
        {},
        { 
          logger: console,
          reuploadRequest: sock.updateMediaMessage
        }
      );

      const sticker = new Sticker(buffer, {
        pack: 'JUANCHOTE Bot',
        author: '@ELDELMC',
        type: StickerTypes.FULL,
        quality: 50,
      });

      await sock.sendMessage(from, await sticker.toMessage());
    } catch (err) {
      console.error(err);
      await sock.sendMessage(from, { text: '❌ Ocurrió un error al crear el sticker. El archivo puede no ser compatible o muy pesado.' });
    }
  }
};
