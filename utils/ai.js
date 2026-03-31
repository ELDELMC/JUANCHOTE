const axios = require('axios');
const { getPersonality } = require('./personality');

const API_KEY = process.env.GROQ_API_KEY;

async function askAI(prompt) {
  if (!API_KEY) {
    console.error("❌ No hay API KEY de Groq");
    return "❌ Falta configurar la API KEY";
  }

  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile", // modelo actualizado
        messages: [
          {
            role: "system",
            content: getPersonality() // 👈 personalidad dinámica
          },
          {
            role: "user",
            content: prompt
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    return response.data.choices[0].message.content;

  } catch (error) {
    console.error("❌ ERROR IA:", error.response?.data || error.message);
    return "❌ Error con la IA.";
  }
}

module.exports = { askAI };