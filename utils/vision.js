const axios = require('axios');

/**
 * Usa exclusivamente Google Gemini (que es excelente y gratis para multimodal)
 * para describir imágenes enviadas en el chat.
 */
async function describeImage(buffer, mimeType) {
  if (!process.env.GEMINI_API_KEY) {
      console.log("No hay GEMINI_API_KEY para analizar la imagen.");
      return null;
  }

  try {
    const base64Data = buffer.toString('base64');
    const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const payload = {
      contents: [{
        parts: [
          { text: "Describe de manera súper breve y concisa qué hay en esta imagen. (Responde en 1 o 2 líneas, sin formalismos)." },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data
            }
          }
        ]
      }]
    };

    const response = await axios.post(url, payload, {
      headers: { "Content-Type": "application/json" }
    });

    const description = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    return description ? description.trim() : "Una imagen indescifrable.";

  } catch (error) {
    console.error("❌ Error en Vision (Gemini):", error.response?.data || error.message);
    return null;
  }
}

module.exports = { describeImage };
