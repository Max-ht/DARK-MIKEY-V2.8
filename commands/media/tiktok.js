/**
 * TikTok Downloader — /tiktok
 * Méthode 1 : siputzx (champ correct : data.data.urls[0])
 * Méthode 2 : ruhend-scraper ttdl() — scraper mobile, déjà dans le projet
 * Méthode 3 : tikwm.com
 * L'envoi se fait par URL directe (Baileys stream) plutôt que par buffer pré-téléchargé,
 * ce qui évite bien des échecs liés aux en-têtes/réseau serveur.
 */
const axios = require('axios');
const config = require('../../config');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function viaSiputzx(url) {
  const { data } = await axios.get('https://api.siputzx.my.id/api/d/tiktok', {
    params: { url }, timeout: 20000,
    headers: { accept: '*/*', 'User-Agent': UA }
  });
  if (data?.status && data?.data) {
    const d = data.data;
    const videoUrl = d.urls?.[0] || d.video_url || d.url || d.download_url || null;
    const title = d.metadata?.title || d.title || '';
    if (videoUrl) return { videoUrl, title };
  }
  return null;
}

async function viaRuhend(url) {
  const { ttdl } = require('ruhend-scraper');
  const result = await ttdl(url);
  const list = result?.data;
  if (Array.isArray(list) && list.length) {
    const vid = list.find(m => m.type === 'video' || /\.(mp4|mov|webm)$/i.test(m.url || ''));
    if (vid?.url) return { videoUrl: vid.url, title: '' };
    if (list[0]?.url) return { videoUrl: list[0].url, title: '' };
  }
  return null;
}

async function viaTikwm(url) {
  const { data } = await axios.get('https://www.tikwm.com/api/', {
    params: { url, hd: 1 }, timeout: 20000,
    headers: { 'User-Agent': UA }
  });
  const d = data?.data;
  const videoUrl = d?.hdplay || d?.play || null;
  if (videoUrl) return { videoUrl: videoUrl.startsWith('http') ? videoUrl : 'https://www.tikwm.com' + videoUrl, title: d?.title || '' };
  return null;
}

module.exports = {
  name: 'tiktok',
  aliases: ['tt', 'ttdl', 'tiktokdl'],
  category: 'media',
  description: 'Télécharger une vidéo TikTok',
  usage: '/tiktok <lien TikTok>',

  async execute(sock, msg, args) {
    const chatId = msg.key.remoteJid;
    const input = args.join(' ').trim();
    const urlMatch = input.match(/https?:\/\/\S*tiktok\S*/i);
    const url = urlMatch ? urlMatch[0] : input;

    if (!url || !/tiktok/i.test(url)) {
      return sock.sendMessage(chatId, {
        text: '❌ *Usage :* /tiktok <lien TikTok>\n_Ex : /tiktok https://vt.tiktok.com/ZSgj..._'
      }, { quoted: msg });
    }

    await sock.sendMessage(chatId, { text: '⏳ Téléchargement TikTok...' }, { quoted: msg });

    let result = null;
    const methods = [viaSiputzx, viaRuhend, viaTikwm];
    for (const method of methods) {
      try {
        result = await method(url);
        if (result?.videoUrl) break;
      } catch (e) {
        console.error(`[tiktok ${method.name}]`, e.message);
      }
    }

    if (!result?.videoUrl) {
      return sock.sendMessage(chatId, {
        text: '❌ Impossible de télécharger cette vidéo TikTok.\n_Vérifie que le compte est public et le lien correct._'
      }, { quoted: msg });
    }

    const caption = result.title
      ? `🎵 *${result.title.slice(0, 100)}*\n\n📥 *${config.botName}*`
      : `🎵 *Vidéo TikTok*\n\n📥 *${config.botName}*`;

    try {
      // Envoi direct par URL (Baileys gère le stream lui-même)
      await sock.sendMessage(chatId, {
        video: { url: result.videoUrl },
        mimetype: 'video/mp4',
        caption
      }, { quoted: msg });
    } catch (streamErr) {
      // Fallback : télécharger en buffer si le stream direct échoue
      try {
        const { data: buf } = await axios.get(result.videoUrl, {
          responseType: 'arraybuffer', timeout: 120000,
          maxContentLength: 64 * 1024 * 1024,
          headers: { 'User-Agent': UA, 'Referer': 'https://www.tiktok.com/' }
        });
        await sock.sendMessage(chatId, { video: Buffer.from(buf), mimetype: 'video/mp4', caption }, { quoted: msg });
      } catch (bufErr) {
        console.error('[tiktok buffer fallback]', bufErr.message);
        await sock.sendMessage(chatId, { text: '❌ Vidéo trop lourde ou lien expiré.' }, { quoted: msg });
      }
    }
  }
};
