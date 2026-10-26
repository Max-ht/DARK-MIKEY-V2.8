/**
 * utils/antiSpam.js
 * Détection de spam : messages répétés (flood) et liens d'invitation WhatsApp.
 */
const recentMessages = new Map(); // jid -> Map<sender -> { texts: [], times: [] }>

const FLOOD_COUNT = 5;     // nbre de messages identiques = spam
const FLOOD_WINDOW = 10000; // dans 10s
const INVITE_RE = /https?:\/\/(?:chat\.whatsapp\.com|wa\.me\/invite)\//i;
const LINK_RE = /https?:\/\//gi;

function isInviteLink(text) { return INVITE_RE.test(text || ''); }

/**
 * Retourne true si le message est considéré comme spam (flood).
 * Met à jour le cache interne.
 */
function checkFlood(groupJid, senderJid, text) {
  if (!groupJid || !senderJid) return false;
  const key = `${groupJid}::${senderJid}`;
  if (!recentMessages.has(key)) recentMessages.set(key, { texts: [], times: [] });
  const rec = recentMessages.get(key);
  const now = Date.now();

  // Purger les vieux
  while (rec.times.length && now - rec.times[0] > FLOOD_WINDOW) {
    rec.times.shift(); rec.texts.shift();
  }
  rec.texts.push(text); rec.times.push(now);

  // Flood si FLOOD_COUNT messages identiques dans FLOOD_WINDOW
  const sameCount = rec.texts.filter(t => t === text).length;
  if (sameCount >= FLOOD_COUNT) {
    rec.texts = []; rec.times = [];
    return true;
  }
  return false;
}

/** Compte le nombre de liens dans un texte. */
function countLinks(text) { return ((text || '').match(LINK_RE) || []).length; }

// Nettoyage périodique du cache flood
setInterval(() => {
  const now = Date.now();
  for (const [key, rec] of recentMessages) {
    while (rec.times.length && now - rec.times[0] > FLOOD_WINDOW * 6) {
      rec.times.shift(); rec.texts.shift();
    }
    if (rec.times.length === 0) recentMessages.delete(key);
  }
}, 60000);

module.exports = { checkFlood, isInviteLink, countLinks };
