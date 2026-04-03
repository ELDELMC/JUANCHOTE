# 🤖 JUANCHOTE - WhatsApp Bot Pro 🚀

¡Bienvenido a **JUANCHOTE**, el bot de WhatsApp más completo, modular y fácil de usar! Este proyecto ha sido diseñado desde cero para ser rápido, inteligente y totalmente expandible.

---

## 🌟 ¿Qué hace a JUANCHOTE especial?

A diferencia de los bots tradicionales, **JUANCHOTE** utiliza una **Arquitectura Modular**. Esto significa que cada función vive en su propio archivo, lo que lo hace increíblemente estable y fácil de mejorar. ¡Solo añade un archivo `.js` en la carpeta `comandos/` y el bot aprenderá la nueva función automáticamente!

Además, cuenta con una **IA Selectiva** que sabe cuándo participar y cuándo guardar silencio, evitando molestias en grupos concurridos.

---

## 🛠️ Funcionalidades Principales

### 🎙️ IA Audio & Voz Nativa (Whisper V3 + TTS)
*   **Transcripción Automática:** Si envías una nota de voz, el bot la transcribirá instantáneamente por ti (si está activado en el grupo).
*   **Respuesta por Voz:** Si le hablas por audio a la IA, ¡JUANCHOTE te responderá con una nota de voz nativa!
*   **Tecnología:** Utiliza **Groq Whisper v3-turbo** para entenderte y **Edge TTS** para hablarte con una claridad asombrosa.

### 🖼️ Sticker Factory
*   **Comando:** `.s` o `.sticker`
*   **Descripción:** Envía una imagen o video corto, o responde a uno, y el bot lo convertirá instantáneamente en un sticker de alta calidad.

### 📚 Wikipedia Fast-Search
*   **Comando:** `.wiki [tema]`
*   **Descripción:** Obtén un resumen rápido de cualquier tema directamente en el chat. Ideal para resolver dudas en medio de una conversación grupal.

### 🧠 Inteligencia Artificial Avanzada
*   **Uso:** ¡Solo háblale! (o menciónalo en grupos).
*   **Descripción:** El bot procesa lenguaje natural. Puedes preguntarle cosas, pedirle consejos o simplemente charlar.
*   **Modo Silencio:** Si la IA detecta que la conversación no va con ella o es spam, responderá internamente con `IGNORAR` para no interrumpir el flujo del grupo.
*   **Personalidad:** Configura su comportamiento con el comando `.personalidad`.

### 🎮 Mini-Juegos y Azar
*   **Comandos:** 
    *   `.dado` 🎲 : Tira un dado virtual.
    *   `.moneda` 🪙 : Cara o cruz para decidir algo rápido.
    *   `.suerte` 🔮 : Tu predicción del día generada aleatoriamente.
    *   `.menu` 📜 : El panel principal que muestra todos los comandos activos.

### ⚙️ Configuración y Utilidades
*   **Comandos:**
    *   `.audios [on|off]` 🔊 : Los administradores pueden activar o desactivar el procesamiento de audios en el grupo.
    *   `.mute [tiempo]` 🔇 : Los administradores pueden silenciar a un miembro específico. El bot borrará sus mensajes por el tiempo indicado (ej: `.mute 1h`).
    *   `.ping` ⚡ : Verifica la velocidad de respuesta del bot.
*   **Prefijos Inteligentes:** Ahora el bot responde a los prefijos **`.`**, **`,`**, y **`!`**, y permite un espacio opcional (ej: `! ping`).
*   **Reacciones Automáticas:** El bot reaccará con un ✅ a los mensajes grupales para confirmar que los ha recibido.

### 🛡️ Herramientas Administrativas
*   **Comando:** `.admin [acción]`
*   **Acciones:** `kick`, `promote`, `demote`, `mute` (grupo completo), `unmute`, `tagall`.
*   **Seguridad:** Solo los dueños o administradores configurados en el `.env` pueden usar estas potentes herramientas.

---

## 🚀 Instalación y Configuración

### 1️⃣ Requisitos Previos
*   [Node.js](https://nodejs.org/) (Versión 16 o superior)
*   [FFmpeg](https://ffmpeg.org/) (Necesario para el procesamiento de audio/videos)
*   Una API Key de [Groq](https://console.groq.com/) (Gratis para empezar)

### 2️⃣ Clonar e Instalar
```bash
git clone https://github.com/ELDELMC/JUANCHOTE.git
cd JUANCHOTE
npm install
```

### 3️⃣ Configurar Variables de Entorno
Crea un archivo `.env` en la raíz del proyecto con la siguiente estructura:
```env
GROQ_API_KEY=tu_api_key_aqui
OWNERS=tu_numero_aqui
ADMINS=numero1,numero2
```

### 4️⃣ Iniciar el Bot
```bash
npm start
```

---

## 🧩 Cómo añadir tus propios comandos (Sistema Modular)

¡Es súper sencillo! Solo crea un archivo en `comandos/nombre_del_comando.js`:

```javascript
module.exports = {
  command: ['mi_comando', 'alias1'],
  handler: async ({ sock, from, text }) => {
    await sock.sendMessage(from, { text: '¡Hola! Este es un nuevo comando modular.' });
  }
};
```
¡Y listo! Al reiniciar el bot, el comando estará activo.

---

## 🤝 Créditos y Contribuciones

Desarrollado con ❤️ por **@ELDELMC**. 

Si quieres contribuir, haz un fork del repo y envía tu Pull Request. ¡Toda ayuda es bienvenida para hacer de JUANCHOTE el mejor bot de la comunidad!

---

*¡Hecho con [Baileys](https://github.com/WhiskeySockets/Baileys) y mucho café!* ☕✨