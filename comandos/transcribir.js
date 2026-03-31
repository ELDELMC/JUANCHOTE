const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { transcribeAudio } = require('../utils/audio');

module.exports = {
  command: ['transcribir', 'audio'],
  handler: async ({ sock, msg, from }) => {
    const isQuotedAudio = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.audioMessage;
    
    if (!isQuotedAudio) {
      return await sock.sendMessage(from, { text: '❌ Debes responder a una nota de voz con .transcribir' });
    }

    try {
      await sock.sendMessage(from, { text: '⏳ Escuchando y transcribiendo el audio... (esto puede tomar un momento)' });

      const buffer = await downloadMediaMessage(
        { message: msg.message.extendedTextMessage.contextInfo.quotedMessage },
        'buffer',
        {},
        { logger: console, reuploadRequest: sock.updateMediaMessage }
      );

      const transcription = await transcribeAudio(buffer);

      await sock.sendMessage(from, { text: `🎙️ *Transcripción:*\n\n"${transcription}"` }, { quoted: msg });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(from, { text: '❌ Error al transcribir el audio. Podría ser demasiado largo o ilegible.' });
    }
  }
};
