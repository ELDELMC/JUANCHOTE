const axios = require('axios');
const { getPersonality } = require('./personality');

// 🔌 Configuración de proveedores (Gemini, Groq, x.ai)
const getProviders = () => [
  {
    name: "GROQ",
    key: process.env.GROQ_API_KEY,
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    type: "openai"
  },
  {
    name: "GEMINI",
    key: process.env.GEMINI_API_KEY,
    url: "https://generativelanguage.googleapis.com/v1beta/models/" + (process.env.GEMINI_MODEL || "gemini-1.5-flash") + ":generateContent",
    type: "google"
  },
  {
    name: "XAI",
    key: process.env.XAI_API_KEY,
    url: "https://api.x.ai/v1/chat/completions",
    model: process.env.XAI_MODEL || "grok-2-1212",
    type: "openai"
  }
];

/**
 * 🛠️ Lógica central de llamada a cada API (Unificada)
 */
async function callApi(provider, systemPrompt, userPrompt) {
  if (provider.type === "google") {
    const res = await axios.post(`${provider.url}?key=${provider.key}`, {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userPrompt }] }]
    });
    return res.data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  }

  // OpenAI Flow (Grok, Groq)
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

/**
 * 🤖 Función de IA con FALLBACK automático para conversación general
 */
async function askAI(prompt, isGroup = false) {
  const providers = getProviders().filter(p => p.key);
  
  if (providers.length === 0) {
    return "❌ Error de configuración: No se encontraron llaves de IA válidas en .env.";
  }

  let systemContent = getPersonality(isGroup);
  if (isGroup) {
     systemContent += "\n\nIMPORTANTE (MODO GRUPO): El grupo se llama JuanChote. Responde de forma casual. Si crees que no te incumbe, di: IGNORAR";
  }

  for (const provider of providers) {
    try {
      console.log(`🧠 Intentando con: ${provider.name}...`);
      const response = await callApi(provider, systemContent, prompt);
      if (response) return response;
    } catch (error) {
      console.warn(`⚠️ ${provider.name} falló: ${error.message}`);
    }
  }

  return "❌ Lo siento, todas las fuentes de inteligencia están saturadas o fallando.";
}

/**
 * 📊 Detector de intención con FALLBACK (Unificado)
 */
async function detectarIntencionContable(prompt) {
  const providers = getProviders().filter(p => p.key);
  if (providers.length === 0) return "NADA";

  const systemPrompt = `Eres un clasificador de intenciones para un bot de contabilidad. 
Analiza el mensaje y responde ÚNICAMENTE con una de estas palabras: INICIAR, CERRAR, NUMERO, NADA.
- INICIAR: Si el usuario va a empezar a anotar gastos/ventas.
- CERRAR: Si pide el reporte, el total, o terminó.
- NUMERO: Si el mensaje contiene principalmente cifras de dinero.
- NADA: Cualquier otra cosa casual.`;

  for (const provider of providers) {
    try {
      console.log(`🔍 Clasificando intención con: ${provider.name}...`);
      const match = await callApi(provider, systemPrompt, prompt);
      const normalized = match?.trim().toUpperCase();
      
      if (["INICIAR", "CERRAR", "NUMERO", "NADA"].includes(normalized)) {
          console.log(`🎯 Intención detectada (${provider.name}): ${normalized}`);
          return normalized;
      }
    } catch (e) {
       console.warn(`⚠️ Clasificador ${provider.name} falló: ${e.message}`);
    }
  }
  return "NADA";
}

module.exports = { askAI, detectarIntencionContable, getProviders, callApi };