/**
 * /autovv - Active/désactive l'interception auto des vues uniques
 * Discussions privées uniquement. Owner only.
 */
const autoVVStore = require('../../utils/autoVVStore');

module.exports = {
  name: 'autovv',
  aliases: ['avv', 'autovueunique'],
  category: 'general',
  description: "Active/désactive l'interception automatique des vues uniques (privé)",
  usage: '/autovv',
  ownerOnly: true,

  async execute(sock, msg) {
    const chatId = msg.key.remoteJid;
    const selfJid = String(sock.user.id).split(':')[0] + '@s.whatsapp.net';

    if (chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, {
        text: '❌ */autovv* fonctionne uniquement en discussion privée.'
      }, { quoted: msg });
    }

    const nowEnabled = autoVVStore.toggle(chatId);
    const emoji = nowEnabled ? '✅' : '🔕';
    const état = nowEnabled ? 'ACTIVÉ' : 'DÉSACTIVÉ';
    const _rawNum = String(chatId).split('@')[0].split(':')[0];
    const _isLid  = String(chatId).includes('@lid');
    const num = _isLid ? _rawNum.slice(-6) + '…' : _rawNum;

    // Confirmation dans "Vous"
    await sock.sendMessage(selfJid, {
      text: `${emoji} *Auto-VV ${état}*\n📱 Discussion : +${num}`
    }, {});

    // Message visible dans la discussion
    await sock.sendMessage(chatId, {
      text: `${emoji} *L'interception automatique des vues uniques est ${état}.*`
    }, {});
  }
};
