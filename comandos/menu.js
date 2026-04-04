module.exports = {
  command: ['menu', 'help', 'ayuda', 'menú'],
  handler: async ({ sock, from }) => {
    const menuText = `
🤖 *MENÚ PRINCIPAL JUANCHOTE* 🤖
        
🌟 *Comandos Generales:*
- *.s / .sticker* : Crea un sticker de una imagen o video corto.
- *.wiki [tema]* : Busca un resumen en Wikipedia.
- *.ping* : Verifica si el bot está funcionando.
- *.menu* : Muestra toda esta lista.

🎲 *Minijuegos y Diversión:*
- *.dado* 🎲 : Tira un dado del 1 al 6.
- *.moneda* 🪙 : Lanza una moneda al aire (cara o cruz).
- *.suerte* 🔮 : Descubre tu predicción del día.

🎙️ *Herramientas de IA:*
- (Solo envíame un mensaje normal para hablar conmigo libremente)
- *.transcribir* 📝 : Responde a un mensaje de voz ( Whisper )
- *.ai on/off* ⚙️ : Activa o desactiva la inteligencia artificial en grupos (Solo Admins).

👑 *Administración:*
- *.admin [kick/promote/demote/mute/unmute/tagall]* : Moderación del grupo.

_¡Recuerda que ahora me puedes hablar dejando un espacio después del punto (ej. ". s") si te equivocas!_
`.trim();

    await sock.sendMessage(from, { text: menuText });
  }
};
