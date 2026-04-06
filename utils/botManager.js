const activeBots = new Map();

function addBot(sessionName, sock) {
  activeBots.set(sessionName, sock);
}

function removeBot(sessionName) {
  activeBots.delete(sessionName);
}

function getBot(sessionName) {
  return activeBots.get(sessionName);
}

function getAllBots() {
  return Array.from(activeBots.values());
}

module.exports = {
  activeBots, // Exportamos el Map para usar .keys()
  addBot,
  removeBot,
  getBot,
  getAllBots
};
