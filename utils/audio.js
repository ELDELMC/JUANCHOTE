const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const os = require('os');
const path = require('path');
const googleTTS = require('google-tts-api');
const { EdgeTTS } = require('@travisvn/edge-tts');
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
 * Limpia el texto de markdown y caracteres especiales que el TTS no debe pronunciar.
 */
function cleanTextForTTS(text) {
  if (!text) return "";
  
  return text
    .replace(/[*_~`]/g, '')         // Elimina markdown (*bold*, _italic_, ~strike~, `code`)
    .replace(/[#@]/g, '')           // Elimina # o @ que suelen leerse literal
    .replace(/[-]{2,}/g, ' ')      // Convierte guiones largos en espacios
    .replace(/[\[\]\(\)\{\}]/g, '') // Elimina paréntesis, corchetes, llaves
    .replace(/[|\/\\]/g, ' ')       // Convierte barras en espacios
    .replace(/\s+/g, ' ')          // Normaliza espacios
    .trim();
}

/**
 * Recibe un texto y genera un archivo temporal .ogg en códec libopus (formato Voice Note de WhatsApp).
 * Devuelve la ruta absoluta del archivo generado.
 */
async function textToSpeech(text) {
  const ttsText = cleanTextForTTS(text);
  
  return new Promise(async (resolve, reject) => {
    try {
      const tempMp3 = path.join(os.tmpdir(), `tts_${Date.now()}.mp3`);
      const tempOgg = path.join(os.tmpdir(), `tts_${Date.now()}.ogg`);

      // Intento con OpenAI si existe la KEY (Calidad Premium)
      if (process.env.OPENAI_API_KEY) {
        try {
          const response = await axios.post('https://api.openai.com/v1/audio/speech', {
            model: "tts-1",
            voice: "alloy",
            input: ttsText
          }, {
            headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
            responseType: 'arraybuffer'
          });
          fs.writeFileSync(tempMp3, Buffer.from(response.data));
        } catch (e) {
          console.error("Fallo OpenAI TTS, usando Edge TTS fallback:", e.message);
          await useEdgeTTS(ttsText, tempMp3);
        }
      } else {
        // Por defecto: Edge TTS (Gratis, mucho mejor que Google Translate)
        await useEdgeTTS(ttsText, tempMp3);
      }

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

/**
 * Función auxiliar para usar Edge TTS
 */
async function useEdgeTTS(text, outputPath) {
  // Nota: El constructor espera (texto, voz, opciones)
  // Voces recomendadas: es-CO-SalomeNeural, es-MX-DaliaNeural, es-ES-AlvaroNeural
  const tts = new EdgeTTS(text, 'es-MX-DaliaNeural');
  const { audio } = await tts.synthesize();
  const arrayBuffer = await audio.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));
}

module.exports = { transcribeAudio, textToSpeech, cleanTextForTTS };