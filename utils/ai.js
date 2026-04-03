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
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: systemContent
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

/**
 * 🎯 Detecta si el usuario quiere iniciar, sumar o cerrar una cuenta.
 * Retorna: "INICIAR", "CERRAR", "NUMERO" o "NADA"
 */
async function detectarIntencionContable(prompt) {
  if (!API_KEY) return "NADA";

  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant", // Modelo más rápido para clasificación
        messages: [
          {
            role: "system",
            content: `Eres un clasificador de intenciones para un bot de contabilidad. 
Analiza el mensaje del usuario y responde ÚNICAMENTE con una de estas palabras:
- INICIAR: Si el usuario quiere empezar a hacer una cuenta, sacar porcentajes de ventas, o dice algo como "vamos a hacer la cuenta".
- CERRAR: Si el usuario indica que ya terminó, pide el total, dice "listo", "ya", "saca el resultado" o similar.
- NUMERO: Si el mensaje contiene montos de dinero, números para sumar (ej: "100.000", "50k", "200.000 + 10.000").
- NADA: Si no tiene que ver con contabilidad.

RESPUESTA CORTA: SOLO LA PALABRA.`
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

    const match = response.data.choices[0].message.content.trim().toUpperCase();
    if (["INICIAR", "CERRAR", "NUMERO"].includes(match)) return match;
    return "NADA";

  } catch (error) {
    return "NADA";
  }
}

module.exports = { askAI, detectarIntencionContable };