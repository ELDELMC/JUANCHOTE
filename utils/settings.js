const fs = require('fs');
const path = require('path');

const settingsPath = path.join(__dirname, '../data/group_settings.json');

// Cache in memory
let settingsCache = null;

const defaultSettings = {
  audios_activados: false,
  ai_activada: false,
  react_activada: false,
  bienvenida: "",
  despedida: "",
  reglas: "",
  antilink: false,
  antispam: false,
  strikes: {} // Estructura: { "jid": { count: 0, reasons: [] } }
};

function ensureSettingsFile() {
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadSettings() {
  if (settingsCache) return settingsCache;
  
  ensureSettingsFile();
  try {
    if (!fs.existsSync(settingsPath)) {
      settingsCache = {};
      fs.writeFileSync(settingsPath, JSON.stringify({}, null, 2));
    } else {
      settingsCache = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    }
  } catch (e) {
    console.error("❌ Error cargando group_settings.json:", e);
    settingsCache = {};
  }
  return settingsCache;
}

function saveSettings() {
  if (!settingsCache) return;
  fs.writeFile(settingsPath, JSON.stringify(settingsCache, null, 2), (err) => {
    if (err) console.error("❌ Error al guardar asíncronamente en group_settings.json:", err);
  });
}

function getGroupSettings(groupId) {
  const settings = loadSettings();
  return settings[groupId] || { ...defaultSettings };
}

function updateGroupSettings(groupId, newSettings) {
  const settings = loadSettings();
  
  if (!settings[groupId]) {
    settings[groupId] = { ...defaultSettings };
  }
  
  settings[groupId] = { ...settings[groupId], ...newSettings };
  saveSettings();
  
  return settings[groupId];
}

module.exports = { getGroupSettings, updateGroupSettings };
