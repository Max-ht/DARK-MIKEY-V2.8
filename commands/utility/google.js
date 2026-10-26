/**
 * /google - Recherche Google
 */
const axios = require('axios');
const config = require('../../config');

module.exports = {
  name: 'google',
  aliases: ['recherche', 'cherche', 'search'],
  category: 'utility',
  description: 'Recherche sur Google',
  usage: '/google <recherche>',

  async execute(sock, msg, args, extra) {
    const query = args.join(' ').trim();
    if (!query) return extra.reply('❌ *Usage :* /google <ta recherche>');

    try {
      await extra.reply('🔍 Recherche en cours...');
      const { data } = await axios.get(`https://api.siputzx.my.id/api/s/google`, {
        params: { q: query },
        timeout: 20000,
      });

      const results = data?.data || data?.results || [];
      if (!results.length) return extra.reply('❌ Aucun résultat trouvé.');

      let text = `🔍 *Résultats Google pour :* _${query}_\n\n`;
      results.slice(0, 5).forEach((r, i) => {
        const title = r.title || r.judul || '';
        const link = r.link || r.url || '';
        const desc = r.description || r.snippet || r.deskripsi || '';
        text += `*${i + 1}.* ${title}\n`;
        if (desc) text += `   📝 ${desc.slice(0, 100)}...\n`;
        if (link) text += `   🔗 ${link}\n`;
        text += '\n';
      });

      await sock.sendMessage(msg.key.remoteJid, { text }, { quoted: msg });
    } catch (err) {
      console.error('[google]', err.message);
      extra.reply('❌ Recherche impossible pour le moment. Réessaie plus tard.');
    }
  }
};
