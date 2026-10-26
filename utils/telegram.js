/**
 * utils/telegram.js
 * Envoie des médias/textes vers un canal Telegram privé (cloud secondaire).
 * Si TELEGRAM_BOT_TOKEN ou TELEGRAM_CHANNEL_ID n'est pas configuré, les appels échouent silencieusement.
 */
const https = require('https');
const config = require('../config');

function getToken() { return config.telegram?.botToken || process.env.TELEGRAM_BOT_TOKEN || ''; }
function getChannel() { return config.telegram?.channelId || process.env.TELEGRAM_CHANNEL_ID || ''; }
function isConfigured() { return !!(getToken() && getChannel()); }

/**
 * Envoie un buffer média vers Telegram.
 * @param {Buffer} buffer
 * @param {'image'|'video'|'audio'|'document'} type
 * @param {string} caption
 * @param {string} filename
 */
async function sendMedia(buffer, type, caption = '', filename = 'file') {
  if (!isConfigured()) return null;
  const token = getToken();
  const channelId = getChannel();
  const axios = require('axios');
  const FormData = require('form-data');

  const methodMap = {
    image: 'sendPhoto',
    video: 'sendVideo',
    audio: 'sendAudio',
    document: 'sendDocument',
  };
  const fieldMap = {
    image: 'photo',
    video: 'video',
    audio: 'audio',
    document: 'document',
  };

  const method = methodMap[type] || 'sendDocument';
  const field = fieldMap[type] || 'document';
  const url = `https://api.telegram.org/bot${token}/${method}`;

  const form = new FormData();
  form.append('chat_id', channelId);
  form.append(field, buffer, { filename, contentType: type === 'audio' ? 'audio/ogg' : undefined });
  if (caption) form.append('caption', caption.slice(0, 1024));

  try {
    const { data } = await axios.post(url, form, {
      headers: form.getHeaders(),
      timeout: 60000,
      maxContentLength: 50 * 1024 * 1024,
    });
    return data;
  } catch (err) {
    console.error('[Telegram] Erreur envoi:', err.response?.data?.description || err.message);
    return null;
  }
}

/**
 * Envoie un message texte vers Telegram.
 */
async function sendText(text) {
  if (!isConfigured()) return null;
  const axios = require('axios');
  const token = getToken();
  const channelId = getChannel();
  try {
    const { data } = await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: channelId,
      text: text.slice(0, 4096),
    }, { timeout: 15000 });
    return data;
  } catch (err) {
    console.error('[Telegram] Erreur texte:', err.message);
    return null;
  }
}

module.exports = { sendMedia, sendText, isConfigured };
