const axios = require('axios');

module.exports = {
  command: ['wiki', 'wikipedia'],
  handler: async ({ sock, args, from, msg }) => {
    if (args.length === 0) {
      return await sock.sendMessage(from, { text: '❌ Escribe qué quieres buscar. Ejemplo: .wiki gatos' });
    }

    const query = args.join(' ');
    await sock.sendMessage(from, { text: `🔍 Buscando "${query}" en Wikipedia...` });

    try {
      const { data } = await axios.get(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);

      if (data && data.title && data.extract) {
        let response = `📚 *${data.title}*\n\n${data.extract}`;
        if (data.content_urls && data.content_urls.desktop) {
           response += `\n\n🔗 Leer más: ${data.content_urls.desktop.page}`;
        }
        await sock.sendMessage(from, { text: response }, { quoted: msg });
      } else {
        await sock.sendMessage(from, { text: '❌ No se encontró información sobre eso en Wikipedia.' });
      }
    } catch (err) {
      console.error(err);
      await sock.sendMessage(from, { text: '❌ Error al buscar en Wikipedia. ¿Escribiste bien el nombre o el tema?' });
    }
  }
};
