const axios = require('axios');
const { getPersonality } = require('./personality');

// 🔌 Configuración de proveedores (Gemini, Groq, x.ai)
const getProviders = () => [
  {
    name: "GROQ",
    key: process.env.GROQ_API_KEY,
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: "llama-3.3-70b-versatile",
    type: "openai"
  },
  {
    name: "GEMINI",
    key: process.env.GEMINI_API_KEY,
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-001:generateContent",
    type: "google"
  },
  {
    name: "XAI",
    key: process.env.XAI_API_KEY,
    url: "https://api.x.ai/v1/chat/completions",
    model: "grok-2-1212",
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
    const missing = [];
    if (!process.env.GEMINI_API_KEY) missing.push('GEMINI_API_KEY');
    if (!process.env.GROQ_API_KEY) missing.push('GROQ_API_KEY');
    if (!process.env.XAI_API_KEY) missing.push('XAI_API_KEY');
    return `❌ Error de configuración: No se encontraron llaves de IA válidas en .env. Faltan: ${missing.join(', ')}`;
  }

  const startTotal = Date.now();
  for (const provider of providers) {
    try {
      const startProv = Date.now();
      console.log(`🧠 Intentando con: ${provider.name}...`);
      const response = await callProvider(provider, prompt, isGroup);
      
      const duration = Date.now() - startProv;
      console.log(`🤖 Respuesta IA lista (${provider.name}) en ${duration}ms.`);
      
      if (response) return response;
    } catch (error) {
      const errorMsg = error.response?.data?.error?.message || error.message;
      const errorCode = error.response?.status || "UNK";
      console.warn(`⚠️ ${provider.name} falló [${errorCode}]: ${errorMsg}`);
    }
  }

  console.error("💥 TODAS LAS IAs FALLARON.");
  return "❌ Lo siento, todas las fuentes de inteligencia están saturadas o fallando.";
}

/**
 * 📊 Detector de intención con FALLBACK
 */
async function detectarIntencionContable(prompt) {
  const providers = getProviders().filter(p => p.key);
  if (providers.length === 0) return "NADA";

  const systemPrompt = `Eres un clasificador de intenciones para un bot de contabilidad. 
Analiza el mensaje y responde ÚNICAMENTE con:
- INICIAR: Solo si el usuario dice explícitamente que va a empezar a anotar gastos, ventas, cuentas o cálculos matemáticos nuevos.
- CERRAR: Si pide el reporte final, el total absoluto, o dice frases como 'es todo por hoy', 'terminé la cuenta'.
- NUMERO: Si el mensaje contiene principalmente cifras de dinero.
- NADA: Conversación casual, preguntas sobre el bot, agradecimientos u otros temas.

RESPONDER SOLO CON LA PALABRA.`;

  for (const provider of providers) {
    try {
      let match = "";
      console.log(`🔍 Clasificando intención con: ${provider.name}...`);
      if (provider.type === "google") {
        const res = await axios.post(`${provider.url}?key=${provider.key}`, {
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: prompt }] }]
        });
        match = res.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()?.toUpperCase() || "NADA";
      } else {
        const model = provider.name === "GROQ" ? "llama-3.1-8b-instant" : provider.model;
        const res = await axios.post(provider.url, {
          model,
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }]
        }, { headers: { Authorization: `Bearer ${provider.key}` } });
        match = res.data.choices?.[0]?.message?.content?.trim()?.toUpperCase() || "NADA";
      }
      
      console.log(`🎯 Intención detectada (${provider.name}): ${match}`);
      if (["INICIAR", "CERRAR", "NUMERO"].includes(match)) return match;
      if (match === "NADA") return "NADA";
    } catch (e) {
       console.warn(`⚠️ Clasificador ${provider.name} falló: ${e.message}`);
    }
  }
  return "NADA";
}

/**
 * 🛠️ Lógica central de llamada a cada API
 */
async function callProvider(provider, prompt, isGroup) {
  let systemContent = getPersonality(isGroup);
  if (isGroup) {
     systemContent += "\n\nIMPORTANTE (MODO GRUPO): El grupo se llama JuanChote. Responde de forma casual. Si crees que no te incumbe, di: IGNORAR";
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