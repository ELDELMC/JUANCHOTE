const { askAI } = require('../utils/ai');

module.exports = {
  command: ['ia', 'ai', 'gpt', 'pregunta'],
  handler: async ({ sock, from, args, isGroup }) => {
    const prompt = args.join(' ');
    if (!prompt) return await sock.sendMessage(from, { text: '❌ Uso: !ia ¿cuál es el mejor lenguaje?' });

    try {
      await sock.sendMessage(from, { text: '🧠 Pensando...' });
      const response = await askAI(prompt, isGroup);
      await sock.sendMessage(from, { text: response });
    } catch (e) {
      console.error(e);
      await sock.sendMessage(from, { text: '❌ Error en la IA.' });
    }
  }
};
