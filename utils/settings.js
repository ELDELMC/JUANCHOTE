const fs = require('fs');
const path = require('path');

const settingsPath = path.join(__dirname, '../data/group_settings.json');

function ensureSettingsFile() {
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(settingsPath)) {
    fs.writeFileSync(settingsPath, JSON.stringify({}, null, 2));
  }
}

function getGroupSettings(groupId) {
  ensureSettingsFile();
  const data = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
  return data[groupId] || { 
    audios_activados: false, 
    ai_activada: true,
    react_activada: true,
    bienvenida: "",
    despedida: "",
    reglas: "",
    antilink: false,
    antispam: false,
    strikes: {} // Estructura: { "jid": { count: 0, reasons: [] } }
  };
}

function updateGroupSettings(groupId, newSettings) {
  ensureSettingsFile();
  const data = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
  
  if (!data[groupId]) {
    data[groupId] = { 
      audios_activados: false, 
      ai_activada: true,
      react_activada: true,
      bienvenida: "",
      despedida: "",
      reglas: "",
      antilink: false,
      antispam: false,
      strikes: {}
    };
  }
  
  data[groupId] = { ...data[groupId], ...newSettings };
  
  fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2));
  return data[groupId];
}

module.exports = { getGroupSettings, updateGroupSettings };
