/**
 * /spotify - Informations sur une chanson Spotify
 */
const axios = require('axios');

module.exports = {
  name: 'spotify',
  aliases: ['spot', 'chanson', 'musique'],
  category: 'media',
  description: 'Informations sur une chanson Spotify',
  usage: '/spotify <titre ou lien Spotify>',

  async execute(sock, msg, args, extra) {
    const chatId = msg.key.remoteJid;
    const query = args.join(' ').trim();
    if (!query) return extra.reply('❌ *Usage :* /spotify <titre de la chanson ou lien Spotify>');
    try {
      await extra.reply('🔍 Recherche Spotify en cours...');
      const apis = [
        `https://api.siputzx.my.id/api/s/spotify?q=${encodeURIComponent(query)}`,
        `https://api.princetechn.com/spotify?q=${encodeURIComponent(query)}`,
      ];
      let result;
      for (const api of apis) {
        try {
          const { data } = await axios.get(api, { timeout: 20000 });
          const d = data?.data || data?.result || data;
          if (d?.title || d?.name) { result = d; break; }
        } catch {}
      }
      if (!result) return extra.reply('❌ Chanson introuvable sur Spotify.');

      const title = result.title || result.name || 'Inconnu';
      const artist = result.artist || result.artists || 'Inconnu';
      const album = result.album || '';
      const duration = result.duration || result.time || '';
      const link = result.url || result.spotify_url || result.link || '';
      const preview = result.preview || result.preview_url || '';
      const cover = result.thumbnail || result.cover || result.image || '';

      let text = `🎵 *${title}*\n👤 *Artiste :* ${artist}`;
      if (album) text += `\n💿 *Album :* ${album}`;
      if (duration) text += `\n⏱️ *Durée :* ${duration}`;
      if (link) text += `\n🔗 *Écouter :* ${link}`;
      text += '\n\n⚠️ _Le téléchargement Spotify est protégé — lien d\'écoute fourni_';

      if (cover) {
        try {
          const { data: imgBuf } = await axios.get(cover, { responseType: 'arraybuffer', timeout: 15000 });
          await sock.sendMessage(chatId, { image: Buffer.from(imgBuf), caption: text }, { quoted: msg });
          return;
        } catch {}
      }
      await sock.sendMessage(chatId, { text }, { quoted: msg });

      if (preview) {
        try {
          const { data: audioBuf } = await axios.get(preview, { responseType: 'arraybuffer', timeout: 30000 });
          await sock.sendMessage(chatId, { audio: Buffer.from(audioBuf), ptt: false, mimetype: 'audio/mpeg' }, {});
        } catch {}
      }
    } catch (err) {
      console.error('[spotify]', err.message);
      extra.reply('❌ Erreur lors de la recherche Spotify.');
    }
  }
};
