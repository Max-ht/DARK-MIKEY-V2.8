/** utils/gamesStore.js - Gestion de l'état des parties */
const sessions = new Map();

const GAMES = { qtr:'Questions', aov:'Action ou Vérité', cpc:'Cap ou Pas Cap', tp:'Tu Préfères' };
const DIFF  = { facile:'😄 Facile', moyen:'😏 Moyen', difficile:'🔥 Difficile' };

function create(chatId, opts) {
  sessions.set(chatId, {
    game: opts.game, mode: opts.mode, difficulty: opts.difficulty,
    turnMode: opts.turnMode, players: opts.players || [],
    currentPlayer: 0, round: 0, used: new Set(), active: true,
    lastActivity: Date.now()
  });
}
function get(chatId)    { return sessions.get(chatId) || null; }
function end(chatId)    { sessions.delete(chatId); }
function isActive(chatId) { return sessions.has(chatId) && sessions.get(chatId).active; }
function nextPlayer(chatId) {
  const s = sessions.get(chatId);
  if (!s || !s.players.length) return null;
  s.currentPlayer = (s.currentPlayer + 1) % s.players.length;
  s.lastActivity = Date.now();
  return s.players[s.currentPlayer];
}
function currentPlayer(chatId) {
  const s = sessions.get(chatId);
  if (!s || !s.players.length) return null;
  return s.players[s.currentPlayer];
}
function addPlayer(chatId, jid, name) {
  const s = sessions.get(chatId);
  if (!s) return false;
  if (s.players.find(p => p.jid === jid)) return false;
  s.players.push({ jid, name: name || jid.split('@')[0].split(':')[0] });
  return true;
}
function getQuestion(chatId, data) {
  const s = sessions.get(chatId);
  if (!s) return null;
  let pool;
  if (s.game === 'aov') {
    const isVérité = Math.random() < 0.5;
    pool = data.aov[s.difficulty][isVérité ? 'verites' : 'actions'];
    s._lastAovType = isVérité ? 'Vérité' : 'Action';
  } else {
    pool = data[s.game][s.difficulty];
  }
  const available = pool.map((_, i) => i).filter(i => !s.used.has(i));
  if (!available.length) { s.used.clear(); return getQuestion(chatId, data); }
  const idx = available[Math.floor(Math.random() * available.length)];
  s.used.add(idx);
  s.round++;
  s.lastActivity = Date.now();
  return { question: pool[idx], type: s._lastAovType || null, round: s.round };
}

module.exports = { create, get, end, isActive, nextPlayer, currentPlayer, addPlayer, getQuestion, GAMES, DIFF };
