/**
 * /instagram - Télécharger un post/reel/story Instagram
 */
const axios = require('axios');
const config = require('../../config');

module.exports = {
  name: 'instagram',
  aliases: ['ig', 'insta', 'reel'],
  category: 'media',
  description: 'Télécharger un post, reel ou story Instagram',
  usage: '/instagram <URL>',

  async execute(sock, msg, args, extra) {
    const chatId = msg.key.remoteJid;
    const url = args[0]?.trim();
    if (!url || !/instagram\.com/i.test(url)) {
      return extra.reply('❌ *Usage :* /instagram <lien Instagram>\n_Ex : /instagram https://www.instagram.com/reel/..._');
    }
    try {
      await extra.reply('⏳ Téléchargement Instagram en cours...');
      const apis = [
        `https://api.siputzx.my.id/api/d/instagram?url=${encodeURIComponent(url)}`,
        `https://api.princetechn.com/ig?url=${encodeURIComponent(url)}`,
      ];
      let mediaUrl, isVideo = false;
      for (const api of apis) {
        try {
          const { data } = await axios.get(api, { timeout: 30000 });
          const dl = data?.url || data?.data?.url || data?.download_url || data?.data?.download_url || data?.video_url || data?.data?.video || data?.data?.image;
          if (dl) { mediaUrl = dl; isVideo = mediaUrl.includes('.mp4') || data?.type === 'video'; break; }
        } catch {}
      }
      if (!mediaUrl) return extra.reply('❌ Impossible de télécharger ce contenu Instagram. Vérifie que le lien est public.');
      const { data: buffer } = await axios.get(mediaUrl, { responseType: 'arraybuffer', timeout: 60000, maxContentLength: 50*1024*1024 });
      const buf = Buffer.from(buffer);
      const caption = `📸 *Instagram*\n\n📥 Téléchargé par *${config.botName}*`;
      if (isVideo) {
        await sock.sendMessage(chatId, { video: buf, caption }, { quoted: msg });
      } else {
        await sock.sendMessage(chatId, { image: buf, caption }, { quoted: msg });
      }
    } catch (err) {
      console.error('[instagram]', err.message);
      extra.reply('❌ Erreur lors du téléchargement. Essaie avec un autre lien ou vérifie que le compte est public.');
    }
  }
};
