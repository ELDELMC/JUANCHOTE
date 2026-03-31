const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

const API_KEY = process.env.GROQ_API_KEY;

// 🎤 Convertir audio a texto
async function speechToText(filePath) {
  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('model', 'whisper-large-v3');

    const response = await axios.post(
      'https://api.groq.com/openai/v1/audio/transcriptions',
      form,
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          ...form.getHeaders()
        }
      }
    );

    return response.data.text;

  } catch (error) {
    console.error("❌ ERROR AUDIO:", error.response?.data || error.message);
    return null;
  }
}

module.exports = { speechToText };