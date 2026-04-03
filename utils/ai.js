const axios = require('axios');
const { getPersonality } = require('./personality');

// 🔌 Configuración de proveedores (Gemini, Groq, x.ai)
const getProviders = () => [
  {
    name: "GEMINI",
    key: process.env.GEMINI_API_KEY,
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent",
    type: "google"
  },
  {
    name: "GROQ",
    key: process.env.GROQ_API_KEY,
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: "llama-3.3-70b-versatile",
    type: "openai"
  },
  {
    name: "XAI",
    key: process.env.XAI_API_KEY,
    url: "https://api.x.ai/v1/chat/completions",
    model: "grok-beta",
    type: "openai"
  }
];

/**
 * 🤖 Función de IA con FALLBACK automático
 * Intenta con cada proveedor configurado hasta que uno responda con éxito.
 */
async function askAI(prompt, isGroup = false) {
  const providers = getProviders().filter(p => p.key);
  
  if (providers.length === 0) {
    return "❌ No hay ninguna IA configurada en .env";
  }

  let lastError = null;

  for (const provider of providers) {
    try {
      console.log(`🧠 Intentando con: ${provider.name}...`);
      const response = await callProvider(provider, prompt, isGroup);
      if (response) return response;
    } catch (error) {
      lastError = error;
      const errorMsg = error.response?.data?.error?.message || error.message;
      const errorCode = error.response?.status || "UNK";
      console.warn(`⚠️ ${provider.name} falló [${errorCode}]: ${errorMsg}`);
      
      if (error.response?.data) {
        console.warn(`📝 Detalle técnico de ${provider.name}:`, JSON.stringify(error.response.data).slice(0, 500));
      }
    }
  }

  // Si llegamos hasta aquí, todas fallaron
  console.error("💥 TODAS LAS IAs FALLARON.");
  return "❌ Lo siento, todas las fuentes de inteligencia están saturadas o fallando. Por favor, intenta de nuevo en unos minutos.";
}

/**
 * 📊 Detector de intención con FALLBACK
 */
async function detectarIntencionContable(prompt) {
  const providers = getProviders().filter(p => p.key);
  if (providers.length === 0) return "NADA";

  const systemPrompt = `Eres un clasificador de intenciones para un bot de contabilidad. 
Analiza el mensaje y responde ÚNICAMENTE con:
- INICIAR: Si quiere empezar una cuenta o sacar porcentajes.
- CERRAR: Si pide el total o dice que ya terminó.
- NUMERO: Si hay dinero o sumas.
- NADA: Otros temas.

RESPONDER SOLO CON LA PALABRA.`;

  for (const provider of providers) {
    try {
      let match = "";
      if (provider.type === "google") {
        const res = await axios.post(`${provider.url}?key=${provider.key}`, {
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: prompt }] }]
        });
        match = res.data.candidates[0].content.parts[0].text.trim().toUpperCase();
      } else {
        const model = provider.name === "GROQ" ? "llama-3.1-8b-instant" : provider.model;
        const res = await axios.post(provider.url, {
          model,
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }]
        }, { headers: { Authorization: `Bearer ${provider.key}` } });
        match = res.data.choices[0].message.content.trim().toUpperCase();
      }
      
      if (["INICIAR", "CERRAR", "NUMERO"].includes(match)) return match;
      if (match === "NADA") return "NADA";
    } catch (e) { /* Sigue al siguiente */ }
  }
  return "NADA";
}

/**
 * 🛠️ Lógica central de llamada a cada API
 */
async function callProvider(provider, prompt, isGroup) {
  let systemContent = getPersonality();
  if (isGroup) {
     systemContent += "\n\nIMPORTANTE (MODO GRUPO): Si crees que no te incumbe, di: IGNORAR";
  }

  if (provider.type === "google") {
    const res = await axios.post(`${provider.url}?key=${provider.key}`, {
      system_instruction: { parts: [{ text: systemContent }] },
      contents: [{ parts: [{ text: prompt }] }]
    });
    return res.data.candidates[0].content.parts[0].text;
  }

  // OpenAI Flow (Grok, Groq)
  const res = await axios.post(provider.url, {
    model: provider.model,
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: prompt }
    ]
  }, {
    headers: {
      Authorization: `Bearer ${provider.key}`,
      "Content-Type": "application/json"
    }
  });

  return res.data.choices[0].message.content;
}

module.exports = { askAI, detectarIntencionContable, getProviders, callProvider };