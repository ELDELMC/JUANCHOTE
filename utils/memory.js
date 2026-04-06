const fs = require('fs');
const path = require('path');

const memoryDir = path.join(__dirname, '../data/memory');

if (!fs.existsSync(memoryDir)) {
  fs.mkdirSync(memoryDir, { recursive: true });
}

function getMemoryPath(chatId) {
  const sanitize = chatId.replace(/[^a-zA-Z0-9-]/g, '_');
  return path.join(memoryDir, `${sanitize}.json`);
}

function readMemory(chatId) {
  const filePath = getMemoryPath(chatId);
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (e) {
      console.error(`Error leyendo la memoria de ${chatId}`, e);
    }
  }
  return { history: [], users: {} };
}

function saveMemory(chatId, memory) {
  const filePath = getMemoryPath(chatId);
  try {
    fs.writeFileSync(filePath, JSON.stringify(memory, null, 2));
  } catch (e) {
    console.error(`Error guardando la memoria de ${chatId}`, e);
  }
}

function saveMessage(chatId, sender, text, isBot = false) {
  const memory = readMemory(chatId);
  
  // Guardar en el historial general (últimos 30 mensajes)
  memory.history.push({ 
    sender: isBot ? 'BOT' : sender, 
    text, 
    timestamp: Date.now() 
  });
  if (memory.history.length > 30) {
    memory.history.shift();
  }

  // Guardar estilo/jerga del usuario (últimos 10 mensajes)
  if (!isBot && sender) {
    if (!memory.users[sender]) {
      memory.users[sender] = { history: [] };
    }
    memory.users[sender].history.push(text);
    if (memory.users[sender].history.length > 10) {
      memory.users[sender].history.shift();
    }
  }

  saveMemory(chatId, memory);
}

function getContextPrompt(chatId, currentSender) {
  const memory = readMemory(chatId);
  let prompt = `\n\n=== MEMORIA Y CONTEXTO DEL CHAT ===\n`;
  
  if (memory.history.length > 0) {
    prompt += `Últimos mensajes (para contexto y seguimiento de conversación):\n`;
    memory.history.slice(-15).forEach(msg => {
      prompt += `[${msg.sender}]: ${msg.text}\n`;
    });
  }

  if (currentSender && memory.users[currentSender]) {
    prompt += `\nESTILO DEL USUARIO [${currentSender}] que te acaba de hablar (APROVECHA para imitar su estilo, emojis, jerga, puntuación):\n`;
    memory.users[currentSender].history.slice(-5).forEach(txt => {
      prompt += `- ${txt}\n`;
    });
    prompt += `\nINSTRUCCIÓN CRUCIAL: Analiza el estilo del usuario [${currentSender}] de arriba. Observa si usa 'v:', emojis específicos, mayúsculas, minúsculas, o groserías locales, y responde de una manera que refleje y se adapte mucho a su personalidad. Eres un integrante más del grupo.\n`;
  }

  return prompt;
}

module.exports = {
  saveMessage,
  getContextPrompt
};
