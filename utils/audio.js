const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const os = require('os');
const path = require('path');
const googleTTS = require('google-tts-api');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

/**
 * Recibe un buffer de audio, lo guarda temporalmente y lo manda a transcribir a Groq-Whisper.
 * Retorna el texto transcrito o lanza un error.
 */
async function transcribeAudio(buffer) {
  const tempFilePath = path.join(os.tmpdir(), `audio_${Date.now()}.ogg`);
  fs.writeFileSync(tempFilePath, buffer);

  try {
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

    const transcription = response.data;
    if (!transcription) throw new Error("La API no devolvió transcripción válida");

    return transcription;
  } finally {
    // Limpiar siempre el archivo temporal
    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
  }
}

/**
 * Recibe un texto y genera un archivo temporal .ogg en códec libopus (formato Voice Note de WhatsApp).
 * Devuelve la ruta absoluta del archivo generado.
 */
async function textToSpeech(text) {
  return new Promise(async (resolve, reject) => {
    try {
      // Si el texto es muy largo, google-tts-api tiene límite de 200 caracteres por default,
      // pero getAudioUrl permite slow/lang. Cortamos o usamos getAllAudioUrls si es largo.
      // Aquí usaremos getAllAudioBase64 que divide el texto automáticamente.
      
      const results = await googleTTS.getAllAudioBase64(text, {
        lang: 'es', 
        slow: false,
        host: 'https://translate.google.com',
        splitPunct: ',.?'
      });

      // Unimos los base64 en un buffer de MP3 completo
      const buffers = results.map(res => Buffer.from(res.base64, 'base64'));
      const finalMp3Buffer = Buffer.concat(buffers);

      const tempMp3 = path.join(os.tmpdir(), `tts_${Date.now()}.mp3`);
      const tempOgg = path.join(os.tmpdir(), `tts_${Date.now()}.ogg`);
      
      fs.writeFileSync(tempMp3, finalMp3Buffer);

      // Convertir MP3 a OGG Opus para que WhatsApp lo acepte como PTT (Voice Note)
      ffmpeg(tempMp3)
        .audioCodec('libopus')
        .on('end', () => {
          fs.unlinkSync(tempMp3);
          resolve(tempOgg);
        })
        .on('error', (err) => {
          console.error("Error en FFmpeg TTS:", err);
          if (fs.existsSync(tempMp3)) fs.unlinkSync(tempMp3);
          reject(err);
        })
        .save(tempOgg);

    } catch (error) {
      console.error("Error en Text-to-Speech:", error);
      reject(error);
    }
  });
}

module.exports = { transcribeAudio, textToSpeech };