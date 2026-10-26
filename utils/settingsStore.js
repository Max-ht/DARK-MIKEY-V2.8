/**
 * Réglages modifiables depuis WhatsApp (setprefix, setbotname, setnewsletter).
 * Stockés dans database/settings.json (ignoré par Git) au lieu de réécrire config.js :
 * config.js reste propre et les valeurs de .env servent de défaut.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'database', 'settings.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8')) || {};
  } catch {
    return {};
  }
}

function set(key, value) {
  const data = load();
  data[key] = value;
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = { load, set };
