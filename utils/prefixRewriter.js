/**
 * Adapte automatiquement les textes envoyés par le bot au préfixe configuré.
 * Les messages d'aide du code d'origine écrivent « .commande » en dur ;
 * quand PREFIX n'est pas '.', on remplace ces mentions par le vrai préfixe
 * (uniquement pour les noms de commandes qui existent vraiment).
 */
const config = require('../config');

// Noms qui ressemblent à des extensions de fichiers / domaines : on ne les touche jamais
const SKIP = new Set([
  'mp3', 'mp4', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'json', 'js', 'txt', 'pdf', 'com',
  'net', 'org', 'html', 'css', 'zip', 'ogg', 'wav', 'opus', 'mkv', 'avi', 'doc', 'docx', 'xls', 'xlsx'
]);

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function install(sock, getCommandNames) {
  if (sock.__prefixRewriterInstalled) return;
  sock.__prefixRewriterInstalled = true;

  let cacheSize = -1;
  let cacheRegex = null;

  const buildRegex = () => {
    const names = [...getCommandNames()].filter(n => /^[a-z][a-z0-9]*$/.test(n) && !SKIP.has(n));
    if (names.length === cacheSize && cacheRegex) return cacheRegex;
    names.sort((a, b) => b.length - a.length);
    cacheSize = names.length;
    // « .nom » précédé d'un début de texte, espace, guillemet, *, _, (, ` ou [ ; jamais suivi d'une lettre ou d'une parenthèse
    cacheRegex = names.length
      ? new RegExp('(^|[\\s"\'`*_(\\[])\\.(' + names.map(escapeRegex).join('|') + ')(?![A-Za-z0-9_(])', 'g')
      : null;
    return cacheRegex;
  };

  const rewrite = (text) => {
    const prefix = config.prefix;
    if (!prefix || prefix === '.' || typeof text !== 'string' || !text.includes('.')) return text;
    const re = buildRegex();
    if (!re) return text;
    return text.replace(re, (_, before, name) => `${before}${prefix}${name}`);
  };

  const original = sock.sendMessage.bind(sock);
  sock.sendMessage = (jid, content, options) => {
    try {
      if (content && typeof content === 'object') {
        if (typeof content.text === 'string') content = { ...content, text: rewrite(content.text) };
        else if (typeof content.caption === 'string') content = { ...content, caption: rewrite(content.caption) };
      }
    } catch (_) { /* on n'empêche jamais l'envoi */ }
    return original(jid, content, options);
  };
}

module.exports = { install };
