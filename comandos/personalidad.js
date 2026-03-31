const { setPersonality } = require('../utils/personality');

module.exports = {
  command: "personalidad",
  permission: "admin",

  handler: async ({ sock, args, from }) => {
    const newPrompt = args.join(" ");

    if (!newPrompt) {
      return sock.sendMessage(from, {
        text: "⚠️ Usa: .personalidad [texto]"
      });
    }

    await setPersonality(newPrompt);

    await sock.sendMessage(from, {
      text: "✅ Personalidad actualizada:\n\n" + newPrompt
    });
  }
};