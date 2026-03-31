function cleanNumber(num) {
  return (num || '').replace(/\D/g, '');
}

// 🔐 listas
function getOwners() {
  return (process.env.OWNERS || '')
    .split(',')
    .map(n => cleanNumber(n))
    .filter(Boolean);
}

function getAdmins() {
  return (process.env.ADMINS || '')
    .split(',')
    .map(n => cleanNumber(n))
    .filter(Boolean);
}

// 🎭 rol
function getRole(msg, sender) {
  const senderClean = cleanNumber(sender);

  // 🔥 PRIORIDAD MÁXIMA: mensajes tuyos
  if (msg.key.fromMe) return 'owner';

  if (getOwners().includes(senderClean)) return 'owner';
  if (getAdmins().includes(senderClean)) return 'admin';

  return 'user';
}

// ✅ permisos
function hasPermission(msg, sender, level = 'user') {
  const role = getRole(msg, sender);

  const levels = {
    owner: 3,
    admin: 2,
    user: 1
  };

  return levels[role] >= levels[level];
}

module.exports = {
  getRole,
  hasPermission
};