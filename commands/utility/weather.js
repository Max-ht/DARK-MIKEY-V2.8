/**
 * Weather Command - Météo (par défaut Haïti / Port-au-Prince)
 */

const axios = require('axios');
const config = require('../../config');

const DEFAULT_CITY = 'Port-au-Prince,HT';

module.exports = {
  name: 'weather',
  aliases: ['w', 'clima', 'meteo', 'météo'],
  category: 'utility',
  description: 'Météo d\'une ville (Haïti par défaut)',
  usage: '.weather [ville]',

  async execute(sock, msg, args) {
    const chatId = msg.key.remoteJid;
    try {
      const apiKey = config.apiKeys.openweather;
      if (!apiKey) {
        return await sock.sendMessage(chatId, {
          text: '⚠️ La commande météo n\'est pas configurée (clé OPENWEATHER_API_KEY manquante).'
        }, { quoted: msg });
      }

      // Sans argument : Port-au-Prince. Avec une ville sans pays : on cherche d'abord en Haïti.
      let query = args.join(' ').trim();
      if (!query) query = DEFAULT_CITY;
      else if (!query.includes(',')) query = `${query},HT`;

      const fetchWeather = (q) => axios.get('https://api.openweathermap.org/data/2.5/weather', {
        params: { q, appid: apiKey, units: 'metric', lang: 'fr' },
        timeout: 15000
      });

      let response;
      try {
        response = await fetchWeather(query);
      } catch (err) {
        // Ville introuvable en Haïti : on retente sans restriction de pays
        const raw = args.join(' ').trim();
        if (err.response?.status === 404 && raw && !raw.includes(',')) response = await fetchWeather(raw);
        else throw err;
      }

      const w = response.data;
      const text =
        `🌤️ *Météo à ${w.name}, ${w.sys?.country || ''}*\n\n` +
        `• Temps : ${w.weather[0].description}\n` +
        `• Température : ${Math.round(w.main.temp)}°C (ressenti ${Math.round(w.main.feels_like)}°C)\n` +
        `• Humidité : ${w.main.humidity}%\n` +
        `• Vent : ${Math.round((w.wind?.speed || 0) * 3.6)} km/h`;

      await sock.sendMessage(chatId, { text }, { quoted: msg });
    } catch (error) {
      console.error('Error fetching weather:', error.message);
      const notFound = error.response?.status === 404;
      await sock.sendMessage(chatId, {
        text: notFound ? '❌ Ville introuvable. Essaie par exemple : .weather Cap-Haïtien' : '❌ Impossible de récupérer la météo pour le moment.'
      }, { quoted: msg });
    }
  }
};
