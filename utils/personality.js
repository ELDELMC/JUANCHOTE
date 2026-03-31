const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../data/personality.json');

function getPersonality() {
  if (!fs.existsSync(filePath)) {
    return "Eres un asistente colombiano, amigable y útil.";
  }

  const data = JSON.parse(fs.readFileSync(filePath));
  return data.prompt;
}

function setPersonality(newPrompt) {
  fs.writeFileSync(filePath, JSON.stringify({ prompt: newPrompt }, null, 2));
}

module.exports = { getPersonality, setPersonality };