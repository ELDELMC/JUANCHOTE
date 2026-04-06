try {
  require('dotenv').config();
} catch (e) {}

const fs = require('fs');
const path = require('path');
const { startBot, setCommands } = require('./engine');
const { normalizeString } = require('./utils/helpers');

// 🔄 Carga dinámica de comandos
const comandosPath = path.join(__dirname, 'comandos');
const commandFiles = fs.readdirSync(comandosPath).filter(file => file.endsWith('.js'));
const commands = new Map();

for (const file of commandFiles) {
  try {
    const cmdModule = require(path.join(comandosPath, file));
    if (cmdModule.command && cmdModule.handler) {
      if (Array.isArray(cmdModule.command)) {
        cmdModule.command.forEach(cmd => commands.set(normalizeString(cmd), cmdModule));
      } else {
        commands.set(normalizeString(cmdModule.command), cmdModule);
      }
    }
  } catch (e) {
    console.error(`❌ Error cargando comando ${file}:`, e.message);
  }
}

setCommands(commands);

// 🛡️ AUTO-INICIO ROBUSTO MULTI-SESIÓN
function launchSystem() {
  const allDirs = fs.readdirSync(__dirname).filter(d => d.startsWith('auth') && fs.lstatSync(path.join(__dirname, d)).isDirectory());
  console.log('🔄 Inicializando enjambre Multi-Bot. Sesiones vivas detectadas:', allDirs);
  
  // Siempre iniciar el principal
  startBot('auth', true);

  // Iniciar las sesiones hermanas/auxiliares si existen
  for (const dir of allDirs) {
    if (dir !== 'auth') {
      console.log(`🔌 Cargando bot auxiliar guardado: ${dir}`);
      setTimeout(() => startBot(dir, false), 5000); 
    }
  }
}

launchSystem();