/**
 * utils/rappelStore.js
 * Rappels en mémoire. Éphémères (perdus au redémarrage).
 */
let nextId = 1;
const timers = new Map(); // id -> { timeout, jid, text, expiresAt }

function parseDelay(str) {
  const s = (str || '').trim().toLowerCase();
  const match = s.match(/^(\d+(?:[.,]\d+)?)(s|sec|m|min|h|heure|heures|j|jour|jours|d|day|days)?$/);
  if (!match) return null;
  const val = parseFloat(match[1].replace(',', '.'));
  const unit = match[2] || 'm';
  if (unit.startsWith('s')) return Math.round(val * 1000);
  if (unit.startsWith('m')) return Math.round(val * 60 * 1000);
  if (unit.startsWith('h')) return Math.round(val * 3600 * 1000);
  if (unit.startsWith('j') || unit.startsWith('d')) return Math.round(val * 86400 * 1000);
  return null;
}

function add(jid, delayMs, text, callback) {
  const id = nextId++;
  const expiresAt = Date.now() + delayMs;
  const timeout = setTimeout(() => {
    timers.delete(id);
    callback(id, jid, text);
  }, delayMs);
  timers.set(id, { timeout, jid, text, expiresAt });
  return id;
}

function cancel(id) {
  if (!timers.has(id)) return false;
  clearTimeout(timers.get(id).timeout);
  timers.delete(id);
  return true;
}

function list(jid) {
  return [...timers.entries()]
    .filter(([, v]) => v.jid === jid)
    .map(([id, v]) => ({ id, text: v.text, expiresAt: v.expiresAt }));
}

module.exports = { add, cancel, list, parseDelay };
