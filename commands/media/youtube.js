/**
 * /ytmp4 - Télécharger une vidéo YouTube
 * /ytmp3 - Télécharger l'audio d'une vidéo YouTube
 *
 * Méthode principale : @distube/ytdl-core — parle directement à YouTube
 * (pas d'API tierce à deviner), activement maintenu et met à jour ses
 * correctifs bien plus vite que l'ancien "ytdl-core".
 * Repli : ruhend-scraper (déjà utilisé avec succès pour TikTok).
 */
const axios = require('axios');
const ytdl = require('@distube/ytdl-core');
const ytSearch = require('yt-search');
const config = require('../../config');

const YT_RE = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i;
const MAX_DURATION_SEC = 20 * 60; // 20 minutes, pour éviter des fichiers trop lourds

async function viaDistube(url, format) {
  const info = await ytdl.getInfo(url);
  const title = info.videoDetails?.title || 'YouTube';
  const durationSec = parseInt(info.videoDetails?.lengthSeconds || '0', 10);

  if (durationSec > MAX_DURATION_SEC) {
    throw new Error(`Vidéo trop longue (${Math.round(durationSec / 60)} min, max ${MAX_DURATION_SEC / 60} min).`);
  }

  const options = format === 'ytmp4'
    ? { filter: 'videoandaudio', quality: 'highest' }
    : { filter: 'audioonly', quality: 'highestaudio' };

  const streamFmt = ytdl.chooseFormat(info.formats, options);
  if (!streamFmt) throw new Error('Aucun format disponible pour cette vidéo.');

  const chunks = [];
  await new Promise((resolve, reject) => {
    const stream = ytdl.downloadFromInfo(info, { format: streamFmt });
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', resolve);
    stream.on('error', reject);
  });

  return { buffer: Buffer.concat(chunks), title };
}

async function viaRuhend(url, format) {
  const scraper = require('ruhend-scraper');
  // Noms d'export possibles selon les versions du paquet — on essaie sans planter si absent
  const fnNames = format === 'ytmp4'
    ? ['ytmp4', 'youtube', 'ytdl', 'yta']
    : ['ytmp3', 'youtubeAudio', 'ytdlAudio'];

  for (const name of fnNames) {
    if (typeof scraper[name] !== 'function') continue;
    try {
      const result = await scraper[name](url);
      const dlUrl = result?.data?.url || result?.data?.download_url || result?.url;
      const title = result?.data?.title || result?.title || '';
      if (dlUrl) {
        const { data: buf } = await axios.get(dlUrl, {
          responseType: 'arraybuffer', timeout: 120000, maxContentLength: 64 * 1024 * 1024
        });
        return { buffer: Buffer.from(buf), title };
      }
    } catch { /* on essaie le nom suivant */ }
  }
  throw new Error('ruhend-scraper : aucune méthode YouTube disponible.');
}

async function searchYT(query) {
  const { videos } = await ytSearch(query);
  return videos?.[0] || null;
}

async function execute(sock, msg, args, extra, format) {
  const chatId = msg.key.remoteJid;
  const input = args.join(' ').trim();
  if (!input) return extra.reply(`❌ *Usage :* ${config.prefix}${format} <URL ou titre>`);

  try {
    let url = input;
    let searchTitle = '';

    if (!YT_RE.test(input)) {
      await extra.reply('🔍 Recherche YouTube...');
      const result = await searchYT(input);
      if (!result) return extra.reply('❌ Aucun résultat trouvé.');
      url = result.url;
      searchTitle = result.title;
    }

    await extra.reply(`⏳ Téléchargement ${format === 'ytmp4' ? 'vidéo' : 'audio'} en cours...`);

    let result = null;
    for (const method of [viaDistube, viaRuhend]) {
      try {
        result = await method(url, format);
        if (result?.buffer?.length) break;
      } catch (e) {
        console.error(`[youtube ${method.name}]`, e.message);
      }
    }

    if (!result?.buffer?.length) {
      return extra.reply('❌ Impossible de télécharger cette vidéo. Essaie un autre lien.');
    }

    const finalTitle = searchTitle || result.title || 'YouTube';

    if (format === 'ytmp4') {
      await sock.sendMessage(chatId, {
        video: result.buffer,
        caption: `🎬 *${finalTitle}*\n\n📥 *${config.botName}*`
      }, { quoted: msg });
    } else {
      await sock.sendMessage(chatId, {
        audio: result.buffer,
        ptt: false,
        mimetype: 'audio/mpeg',
      }, { quoted: msg });
      await sock.sendMessage(chatId, { text: `🎵 *${finalTitle}*\n\n📥 *${config.botName}*` }, {});
    }
  } catch (err) {
    console.error('[youtube]', err.message);
    await extra.reply(`❌ Erreur : ${err.message}`);
  }
}

module.exports = {
  name: 'ytmp4',
  aliases: ['yt', 'ytvideo', 'youtube'],
  category: 'media',
  description: 'Télécharger une vidéo YouTube',
  usage: '/ytmp4 <URL ou titre>',
  execute: (sock, msg, args, extra) => execute(sock, msg, args, extra, 'ytmp4'),

  subCommands: [{
    name: 'ytmp3',
    aliases: ['ytaudio', 'ytmusic'],
    category: 'media',
    description: "Télécharger l'audio d'une vidéo YouTube",
    usage: '/ytmp3 <URL ou titre>',
    execute: (sock, msg, args, extra) => execute(sock, msg, args, extra, 'ytmp3'),
  }]
};
