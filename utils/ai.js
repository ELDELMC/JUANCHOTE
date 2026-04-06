const axios = require('axios');
const { getPersonality } = require('./personality');

const getProviders = () => [
  {
    name: "GROQ",
    key: process.env.GROQ_API_KEY,
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: process.env.GROQ_MODEL || "llama-3.1-70b-versatile",
    type: "openai"
  },
  {
    name: "GROQ_2",
    key: process.env.GROQ_API_KEY_2,
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: process.env.GROQ_MODEL || "llama-3.1-70b-versatile",
    type: "openai"
  },
  {
    name: "GEMINI",
    key: process.env.GEMINI_API_KEY,
    // URL estandarizada
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
    type: "google"
  },
  {
    name: "OPENROUTER",
    key: process.env.OPENROUTER_API_KEY,
    url: "https://openrouter.ai/api/v1/chat/completions",
    model: "google/gemini-2.0-flash-lite-preview-02-05:free", // Modelo gratuito mas estable
    type: "openai"
  }
];

async function callApi(provider, systemPrompt, userPrompt) {
  if (provider.type === "google") {
    const res = await axios.post(`${provider.url}?key=${provider.key}`, {
      contents: [{ 
        role: "user", 
        parts: [{ text: `INSTRUCCIONES DE SISTEMA:\n${systemPrompt}\n\nMENSAJE DEL USUARIO:\n${userPrompt}` }] 
      }]
    });
    return res.data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  }

  const res = await axios.post(provider.url, {
    model: provider.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  }, {
    headers: {
      Authorization: `Bearer ${provider.key}`,
      "Content-Type": "application/json"
    }
  });

  return res.data.choices?.[0]?.message?.content || null;
}

async function askAI(prompt, isGroup = false, from = null, sender = null) {
  const providers = getProviders().filter(p => p.key);
  if (providers.length === 0) return "❌ Error: Configura las llaves de IA en .env";

  let systemContent = getPersonality(isGroup);

  for (const provider of providers) {
    try {
      console.log(`🧠 Consultando: ${provider.name}...`);
      const response = await callApi(provider, systemContent, prompt);
      if (response) return response;
    } catch (error) {
      // Log silencioso para no ensuciar la consola del usuario
      // console.warn(`⚠️ ${provider.name} falló.`);
    }
  }
  return "❌ IA temporalmente fuera de servicio.";
}

async function detectarIntencionContable(prompt) {
  const providers = getProviders().filter(p => p.key);
  if (providers.length === 0) return "NADA";

  const systemPrompt = `Clasifica: INICIAR, CERRAR, NUMERO, NADA. Responde solo con la palabra.`;

  for (const provider of providers) {
    try {
      // Priorizar Groq para velocidad en deteccion de intenciones
      if (provider.name.includes("OPENROUTER")) continue; 

      const match = await callApi(provider, systemPrompt, prompt);
      const normalized = match?.trim().toUpperCase();
      if (["INICIAR", "CERRAR", "NUMERO", "NADA"].includes(normalized)) return normalized;
    } catch (e) {}
  }
  return "NADA";
}

module.exports = { askAI, detectarIntencionContable, getProviders, callApi };