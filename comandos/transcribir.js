const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const os = require('os');
const path = require('path');

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

      // Groq Whisper requiere un archivo. Usaremos la carpeta temporal del SO.
      const tempFilePath = path.join(os.tmpdir(), `audio_${Date.now()}.ogg`);
      fs.writeFileSync(tempFilePath, buffer);

      const form = new FormData();
      form.append('file', fs.createReadStream(tempFilePath));
      form.append('model', 'whisper-large-v3-turbo');
      form.append('response_format', 'text');

      const response = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', form, {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        }
      });

      fs.unlinkSync(tempFilePath); // Limpiar

      const transcription = response.data;
      if (!transcription) {
        throw new Error("La API no devolvió transcripción válida");
      }

      await sock.sendMessage(from, { text: `🎙️ *Transcripción:*\n\n"${transcription}"` }, { quoted: msg });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(from, { text: '❌ Error al transcribir el audio. Podría ser demasiado largo o ilegible.' });
    }
  }
};
