const activeBots = new Map();

function addBot(sessionName, sock) {
  activeBots.set(sessionName, sock);
}

function removeBot(sessionName) {
  activeBots.delete(sessionName);
}

function getAllBots() {
  return Array.from(activeBots.values());
}

module.exports = {
  addBot,
  removeBot,
  getAllBots
};
