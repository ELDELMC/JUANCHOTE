module.exports = {
  command: 'ping',
  handler: async ({ sock, from }) => {
    await sock.sendMessage(from, {
      text: '🏓 Pong!\n🔥 Bot funcionando correctamente.'
    });
  }
};