/**
 * /facebook - Télécharger une vidéo Facebook
 */
const axios = require('axios');
const config = require('../../config');

module.exports = {
  name: 'facebook',
  aliases: ['fb', 'fbdl'],
  category: 'media',
  description: 'Télécharger une vidéo Facebook',
  usage: '/facebook <URL>',

  async execute(sock, msg, args, extra) {
    const chatId = msg.key.remoteJid;
    const url = args[0]?.trim();
    if (!url || !/facebook\.com|fb\.watch/i.test(url)) {
      return extra.reply('❌ *Usage :* /facebook <lien Facebook>\n_Ex : /facebook https://www.facebook.com/watch?v=..._');
    }
    try {
      await extra.reply('⏳ Téléchargement Facebook en cours...');
      const apis = [
        `https://api.siputzx.my.id/api/d/facebook?url=${encodeURIComponent(url)}`,
        `https://api.princetechn.com/fb?url=${encodeURIComponent(url)}`,
      ];
      let mediaUrl;
      for (const api of apis) {
        try {
          const { data } = await axios.get(api, { timeout: 30000 });
          const dl = data?.url || data?.sd || data?.hd || data?.data?.url || data?.data?.sd;
          if (dl) { mediaUrl = dl; break; }
        } catch {}
      }
      if (!mediaUrl) return extra.reply('❌ Impossible de télécharger cette vidéo Facebook. Vérifie que la vidéo est publique.');
      const { data: buffer } = await axios.get(mediaUrl, { responseType: 'arraybuffer', timeout: 90000, maxContentLength: 64*1024*1024 });
      const buf = Buffer.from(buffer);
      await sock.sendMessage(chatId, {
        video: buf,
        caption: `🎬 *Facebook*\n\n📥 Téléchargé par *${config.botName}*`
      }, { quoted: msg });
    } catch (err) {
      console.error('[facebook]', err.message);
      extra.reply('❌ Erreur lors du téléchargement. La vidéo est peut-être privée ou trop longue.');
    }
  }
};
