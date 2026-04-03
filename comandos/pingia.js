const { getProviders, callProvider } = require('../utils/ai');

module.exports = {
  command: ["pingia", "ping ai"],
  description: "Diagnóstico de disponibilidad y latencia de las 3 IAs configuradas.",
  handler: async ({ sock, from, msg }) => {
    const providers = getProviders().filter(p => !!p.key);
    
    if (providers.length === 0) {
      return await sock.sendMessage(from, { text: "❌ No hay ninguna IA configurada para probar." }, { quoted: msg });
    }

    await sock.sendMessage(from, { text: "🔍 *Prueba de latencia iniciada...* (Esto tomará unos segundos)" }, { quoted: msg });

    const results = [];
    const testPrompt = "Responde con un solo punto (.).";

    for (const provider of providers) {
      const start = Date.now();
      let status = "✅";
      let time = 0;
      let modelUsed = provider.model || "(Gemini Default)";

      try {
        await callProvider(provider, testPrompt, false);
        time = Date.now() - start;
      } catch (error) {
        status = "❌";
        console.error(`Error en diagnóstico para ${provider.name}:`, error.message);
      }
      
      results.push(`*${provider.name}* (${modelUsed})\n- Estatus: ${status}\n- Latencia: ${status === "✅" ? time + "ms" : "N/A"}`);
    }

    const fastest = results.filter(r => r.includes("✅"))
      .sort((a, b) => {
        const timeA = parseInt(a.match(/(\d+)ms/)?.[1] || "99999");
        const timeB = parseInt(b.match(/(\d+)ms/)?.[1] || "99999");
        return timeA - timeB;
      })[0];

    let header = `📊 *REPORTE DE ESTADO IA* 📊\n\n`;
    let body = results.join('\n\n');
    let footer = fastest ? `\n\n⚡ *La más rápida actualmente:* \n${fastest.split('\n')[0]}` : "";

    await sock.sendMessage(from, { text: header + body + footer }, { quoted: msg });
  }
};
