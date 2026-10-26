/**
 * /antidelete - Active/désactive la récupération des messages supprimés
 * Owner only. Fonctionne en privé et en groupe.
 */
const antiDeleteStore = require('../../utils/antiDeleteStore');

module.exports = {
  name: 'antidelete',
  aliases: ['antisupprime', 'antidel', 'nodel'],
  category: 'admin',
  description: 'Active/désactive la récupération des messages supprimés',
  usage: '/antidelete',
  ownerOnly: true,

  async execute(sock, msg) {
    const chatId = msg.key.remoteJid;
    const selfJid = String(sock.user.id).split(':')[0] + '@s.whatsapp.net';

    const nowEnabled = antiDeleteStore.toggle(chatId);
    const emoji = nowEnabled ? '🛡️' : '🔓';
    const état = nowEnabled ? 'ACTIVÉ' : 'DÉSACTIVÉ';

    let nomChat;
    if (chatId.endsWith('@g.us')) {
      try { const meta = await sock.groupMetadata(chatId); nomChat = `groupe *${meta.subject}*`; }
      catch { nomChat = 'ce groupe'; }
    } else {
      nomChat = `discussion +${String(chatId).split('@')[0].split(':')[0]}`;
    }

    await sock.sendMessage(selfJid, {
      text: `${emoji} *Anti-suppression ${état}*\n📍 Portée : ${nomChat}`
    }, {});

    await sock.sendMessage(chatId, {
      text: `${emoji} *La récupération des messages supprimés est ${état} dans cette discussion.*`
    }, {});
  }
};
