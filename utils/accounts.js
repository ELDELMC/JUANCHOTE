const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'data', 'accounts.json');

// Cache in memory
let accountsCache = null;

// Ensure directory exists
const dir = path.dirname(filePath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Load accounts from disk (only once or if cache is null)
 */
const loadAccounts = () => {
  if (accountsCache) return accountsCache;
  
  try {
    if (!fs.existsSync(filePath)) {
      accountsCache = {};
      fs.writeFileSync(filePath, JSON.stringify({}));
    } else {
      accountsCache = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (e) {
    console.error("❌ Error cargando accounts.json:", e);
    accountsCache = {};
  }
  return accountsCache;
};

/**
 * Save accounts to disk asynchronously
 */
const saveAccounts = () => {
  if (!accountsCache) return;
  
  // Use non-blocking write
  fs.writeFile(filePath, JSON.stringify(accountsCache, null, 2), (err) => {
    if (err) console.error("❌ Error al guardar asíncronamente en accounts.json:", err);
  });
};

const iniciarCuenta = (jid) => {
  const accounts = loadAccounts();
  accounts[jid] = {
    active: true,
    total: 0,
    entries: [],
    startTime: Date.now()
  };
  saveAccounts();
  return accounts[jid];
};

const sumarValor = (jid, valor) => {
  const accounts = loadAccounts();
  if (accounts[jid] && accounts[jid].active) {
    accounts[jid].total += valor;
    accounts[jid].entries.push(valor);
    saveAccounts();
    return true;
  }
  return false;
};

const obtenerSesion = (jid) => {
  const accounts = loadAccounts();
  return accounts[jid] || null;
};

const finalizarCuenta = (jid) => {
  const accounts = loadAccounts();
  if (accounts[jid]) {
    const data = { ...accounts[jid] }; // Clone to return
    delete accounts[jid];
    saveAccounts();
    return data;
  }
  return null;
};

module.exports = {
  iniciarCuenta,
  sumarValor,
  obtenerSesion,
  finalizarCuenta
};
