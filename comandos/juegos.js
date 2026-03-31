module.exports = {
  command: ['dado', 'moneda', 'suerte'],
  handler: async ({ sock, from, command }) => {
    if (command === 'dado') {
      const cara = Math.floor(Math.random() * 6) + 1;
      await sock.sendMessage(from, { text: `🎲 Lanzaste el dado y sacaste un *${cara}*` });

    } else if (command === 'moneda') {
      const lados = ['Cara 🪙', 'Cruz 🦅'];
      const resultado = lados[Math.floor(Math.random() * lados.length)];
      await sock.sendMessage(from, { text: `Tiraste una moneda al aire... ¡Salió *${resultado}*!` });

    } else if (command === 'suerte') {
      const suertes = [
        '¡Hoy es tu día de suerte! 🌟',
        'Hmm, mejor quédate en casa hoy... 😬',
        'Todo saldrá bien, confía. ✨',
        'Puede que encuentres dinero en la calle 💸',
        'Vas a tener un día muy productivo 📈',
        'Cuidado, alguien podría estar mintiéndote 👀',
        'Hoy te enterarás de un chisme jugoso 🗣️',
        'Pide un deseo, puede que se cumpla 🌠'
      ];
      const prediccion = suertes[Math.floor(Math.random() * suertes.length)];
      await sock.sendMessage(from, { text: `🔮 Tu suerte para hoy:\n\n${prediccion}` });
    }
  }
};
