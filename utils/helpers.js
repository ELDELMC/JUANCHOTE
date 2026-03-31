function getText(msg) {
  return msg.message?.conversation ||
         msg.message?.extendedTextMessage?.text ||
         msg.message?.imageMessage?.caption ||
         '';
}

function isGroup(jid) {
  return jid.endsWith('@g.us');
}

module.exports = { getText, isGroup };