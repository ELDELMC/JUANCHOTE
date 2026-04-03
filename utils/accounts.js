const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'data', 'accounts.json');

// Asegurar que el archivo existe
if (!fs.existsSync(path.dirname(filePath))) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}
if (!fs.existsSync(filePath)) {
  fs.writeFileSync(filePath, JSON.stringify({}));
}

const loadAccounts = () => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    return {};
  }
};

const saveAccounts = (data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

const iniciarCuenta = (jid) => {
  const accounts = loadAccounts();
  accounts[jid] = {
    active: true,
    total: 0,
    entries: [],
    startTime: Date.now()
  };
  saveAccounts(accounts);
  return accounts[jid];
};

const sumarValor = (jid, valor) => {
  const accounts = loadAccounts();
  if (accounts[jid] && accounts[jid].active) {
    accounts[jid].total += valor;
    accounts[jid].entries.push(valor);
    saveAccounts(accounts);
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
    const data = accounts[jid];
    delete accounts[jid];
    saveAccounts(accounts);
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
