const axios = require('axios');
const { getPersonality } = require('./personality');

const API_KEY = process.env.GROQ_API_KEY;

async function askAI(prompt, isGroup = false) {
  if (!API_KEY) {
    console.error("❌ No hay API KEY de Groq");
    return "❌ Falta configurar la API KEY";
  }

  try {
    let systemContent = getPersonality();
    if (isGroup) {
      systemContent += "\n\nIMPORTANTE (MODO GRUPO): Estás en un chat grupal analizando el último mensaje que alguien envió. Si crees que se están dirigiendo a ti, te están preguntando algo directamente, o mencionan a la Fundación, respóndeles.\nSin embargo, si concluyes que el usuario está conversando con otra persona del grupo sobre cosas que no te incumben, responde EXACTAMENTE y ÚNICAMENTE con la palabra: IGNORAR";
    }

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile", // modelo actualizado
        messages: [
          {
            role: "system",
            content: systemContent // 👈 personalidad dinámica con contexto
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