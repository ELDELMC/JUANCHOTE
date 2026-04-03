const { cleanTextForTTS, textToSpeech } = require('./utils/audio');
const fs = require('fs');
const path = require('path');

async function test() {
  const dirtyText = "*Hola* #Juanchote! @mundo [test] (ignore) _italic_ ~strike~ `code`.";
  const clean = cleanTextForTTS(dirtyText);
  console.log("Original:", dirtyText);
  console.log("Limpio:", clean);

  if (clean !== "Hola Juanchote! mundo test ignore italic strike code.") {
    console.log("AVISO: La limpieza no fue exacta, revisa si es lo deseado.");
  }

  try {
    console.log("Generando audio (Edge TTS)...");
    const oggPath = await textToSpeech(dirtyText);
    console.log("Archivo generado en:", oggPath);
    
    if (fs.existsSync(oggPath)) {
      const stats = fs.statSync(oggPath);
      console.log(`Tamaño del archivo: ${stats.size} bytes`);
      if (stats.size > 0) {
        console.log("PRUEBA EXITOSA: El archivo se generó correctamente.");
      } else {
        console.error("ERROR: El archivo está vacío.");
      }
      fs.unlinkSync(oggPath);
    } else {
      console.error("ERROR: El archivo no existe.");
    }
  } catch (err) {
    console.error("ERROR en TTS:", err);
  }
}

test();
