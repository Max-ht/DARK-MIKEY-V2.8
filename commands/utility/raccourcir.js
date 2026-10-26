/**
 * /raccourcir - Raccourcir un lien
 */
const axios = require('axios');

module.exports = {
  name: 'raccourcir',
  aliases: ['short', 'shorturl', 'courteurl'],
  category: 'utility',
  description: 'Raccourcir un lien URL',
  usage: '/raccourcir <URL>',

  async execute(sock, msg, args, extra) {
    const url = args[0]?.trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      return extra.reply('❌ *Usage :* /raccourcir https://exemple.com');
    }
    try {
      const { data } = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`, { timeout: 10000, responseType: 'text' });
      if (data && data.startsWith('http')) {
        return extra.reply(`🔗 *Lien raccourci :*\n${data}`);
      }
      // Fallback is.gd
      const { data: d2 } = await axios.get(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`, { timeout: 10000, responseType: 'text' });
      extra.reply(`🔗 *Lien raccourci :*\n${d2}`);
    } catch (err) {
      extra.reply('❌ Impossible de raccourcir ce lien pour le moment.');
    }
  }
};
