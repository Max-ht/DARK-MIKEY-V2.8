/**
 * /jeu - Lancer un jeu (couple ou amis)
 * /prochain /next - Question suivante
 * /rejoindre /join - Rejoindre la partie (groupe, mode auto)
 * /fin /stop - Terminer la partie
 */
const gs = require('../../utils/gamesStore');
const data = require('../../utils/gamesData');
const config = require('../../config');

const HELP = `🎮 *DARK-MIKEY — Jeux*\n
*Comment lancer un jeu :*
\`/jeu [mode] [jeu] [niveau] [tours]\`

*Modes :* couple • amis
*Jeux :*
  • \`questions\` — Questions à tour de rôle
  • \`aov\` — Action ou Vérité
  • \`cpc\` — Cap ou Pas Cap
  • \`tp\` — Tu Préfères
*Niveaux :* facile • moyen • difficile
*Tours :* auto _(le bot désigne)_ • manuel _(vous gérez)_

*Exemples :*
• \`/jeu couple questions facile auto\`
• \`/jeu amis aov difficile manuel\`

*Pendant la partie :*
• \`/prochain\` — question suivante
• \`/rejoindre\` — rejoindre _(auto, groupe)_
• \`/fin\` — terminer`;

const parseMode = s => ({ couple:'couple', amis:'amis', friends:'amis', ami:'amis' }[s] || null);
const parseGame = s => ({ questions:'qtr', qtr:'qtr', 'action':'aov', 'vérité':'aov', aov:'aov', cpc:'cpc', cap:'cpc', 'tu':'tp', preferes:'tp', 'tu préfères':'tp', tp:'tp' }[s] || null);
const parseDiff = s => ({ facile:'facile', easy:'facile', moyen:'moyen', medium:'moyen', difficile:'difficile', hard:'difficile', diff:'difficile' }[s] || null);
const parseTurn = s => ({ auto:'auto', automatique:'auto', manuel:'manuel', manual:'manuel', manu:'manuel' }[s] || null);

function gameLabel(g) { return gs.GAMES[g] || g; }
function diffLabel(d) { return gs.DIFF[d] || d; }

function mention(jid) { return '@' + jid.split('@')[0].split(':')[0]; }

async function sendQuestion(sock, chatId, s) {
  const q = gs.getQuestion(chatId, data);
  if (!q) return;

  const g = s.game;
  let header = '';
  let body = q.question;

  if (g === 'aov') {
    header = q.type === 'Vérité' ? '🔵 *VÉRITÉ*' : '🔴 *ACTION*';
  } else if (g === 'qtr') {
    header = '❓ *QUESTION*';
  } else if (g === 'cpc') {
    header = '💪 *CAP OU PAS CAP ?*';
  } else if (g === 'tp') {
    header = '🤔 *TU PRÉFÈRES...*';
  }

  let target = '';
  if (s.turnMode === 'auto' && s.players.length > 0) {
    const p = gs.currentPlayer(chatId);
    target = p ? `\n👤 *${p.name}* — à toi !\n` : '';
  }

  const text = `${header}${target}\n\n_${body}_\n\n🔢 Question ${q.round} • ${diffLabel(s.difficulty)}\n_/prochain pour continuer • /fin pour arrêter_`;

  await sock.sendMessage(chatId, {
    text,
    mentions: s.turnMode === 'auto' && s.players.length ? [gs.currentPlayer(chatId)?.jid].filter(Boolean) : []
  });
}

module.exports = {
  name: 'jeu',
  aliases: ['game', 'jouer', 'jeux'],
  category: 'general',
  description: 'Lancer un jeu (couple ou amis)',
  usage: '/jeu [couple|amis] [questions|aov|cpc|tp] [facile|moyen|difficile] [auto|manuel]',

  async execute(sock, msg, args, extra) {
    const chatId = msg.key.remoteJid;
    const senderJid = msg.key.participant || msg.key.remoteJid;

    // /fin
    if (['fin','stop','end','arreter','arrêter'].includes(args[0]?.toLowerCase())) {
      if (!gs.isActive(chatId)) return extra.reply('❌ Aucune partie en cours.');
      gs.end(chatId);
      return extra.reply('🛑 *Partie terminée !* Merci d\'avoir joué 🎮');
    }

    // /prochain /next
    if (['prochain','next','suivant','suite'].includes(args[0]?.toLowerCase())) {
      if (!gs.isActive(chatId)) return extra.reply('❌ Aucune partie en cours. Lance /jeu pour commencer !');
      const s = gs.get(chatId);
      if (s.turnMode === 'auto' && s.players.length > 0) gs.nextPlayer(chatId);
      return sendQuestion(sock, chatId, s);
    }

    // /rejoindre
    if (['rejoindre','join','participer'].includes(args[0]?.toLowerCase())) {
      if (!gs.isActive(chatId)) return extra.reply('❌ Aucune partie en cours.');
      const s = gs.get(chatId);
      if (s.turnMode !== 'auto') return extra.reply('❌ Cette partie est en mode manuel, pas besoin de rejoindre.');
      const name = args.slice(1).join(' ') || senderJid.split('@')[0].split(':')[0];
      const added = gs.addPlayer(chatId, senderJid, name);
      if (!added) return extra.reply('✅ Tu es déjà dans la partie !');
      return extra.reply(`✅ *${name}* a rejoint la partie ! (${s.players.length} joueur${s.players.length > 1 ? 's' : ''})`);
    }

    // Si partie déjà active
    if (gs.isActive(chatId)) {
      const s = gs.get(chatId);
      return extra.reply(`⚠️ Une partie de *${gameLabel(s.game)}* est déjà en cours !\n\n• /prochain — question suivante\n• /fin — terminer`);
    }

    // Pas d'args → aide
    if (!args.length) return extra.reply(HELP);

    // Parser les arguments
    const a = args.map(x => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
    let mode, game, diff, turns;
    for (const w of a) {
      if (!mode) mode = parseMode(w);
      else if (!game) game = parseGame(w);
      else if (!diff) diff = parseDiff(w);
      else if (!turns) turns = parseTurn(w);
    }

    if (!mode) return extra.reply('❌ Précise le mode : *couple* ou *amis*\n\n' + HELP);
    if (!game) return extra.reply('❌ Précise le jeu : *questions*, *aov*, *cpc* ou *tp*\n\n' + HELP);
    if (!diff) diff = 'facile';
    if (!turns) turns = 'manuel';

    // Créer la session
    let players = [];
    if (turns === 'auto') {
      // En privé : 2 joueurs automatiques
      if (!chatId.endsWith('@g.us')) {
        const otherJid = chatId;
        const selfJid = String(sock.user.id).split(':')[0] + '@s.whatsapp.net';
        players = [
          { jid: senderJid, name: (args.find(a => a.length > 3 && !parseMode(a.toLowerCase()) && !parseGame(a.toLowerCase()) && !parseDiff(a.toLowerCase()) && !parseTurn(a.toLowerCase())) || 'Joueur 1') },
          { jid: selfJid, name: config.botName }
        ];
      }
      // En groupe : les joueurs rejoignent avec /rejoindre
    }

    gs.create(chatId, { game, mode, difficulty: diff, turnMode: turns, players });
    const s = gs.get(chatId);

    let startMsg = `🎮 *${gameLabel(game).toUpperCase()}*\n`;
    startMsg += `👥 Mode : *${mode}* • ${diffLabel(diff)}\n`;
    startMsg += `🎯 Tours : *${turns === 'auto' ? 'Automatique' : 'Manuel'}*\n\n`;

    if (turns === 'auto' && chatId.endsWith('@g.us')) {
      startMsg += `*Rejoignez la partie avec /rejoindre [votre prénom]*\n`;
      startMsg += `Tapez */prochain* quand vous êtes prêts pour commencer !`;
      return sock.sendMessage(chatId, { text: startMsg });
    }

    startMsg += '▶️ *C\'est parti !*';
    await sock.sendMessage(chatId, { text: startMsg });
    await new Promise(r => setTimeout(r, 1000));
    await sendQuestion(sock, chatId, s);
  }
};

// Commandes secondaires comme alias directement dans le loader
module.exports.subCommands = [
  { name: 'prochain', aliases: ['next','suivant'], category: 'general', description: 'Question suivante',
    execute: async (sock, msg, args, extra) => {
      const chatId = msg.key.remoteJid;
      if (!gs.isActive(chatId)) return extra.reply('❌ Aucune partie en cours. Lance /jeu !');
      const s = gs.get(chatId);
      if (s.turnMode === 'auto' && s.players.length > 0) gs.nextPlayer(chatId);
      return sendQuestion(sock, chatId, s);
    }
  },
  { name: 'fin', aliases: ['stop','stopper'], category: 'general', description: 'Terminer la partie',
    execute: async (sock, msg, args, extra) => {
      const chatId = msg.key.remoteJid;
      if (!gs.isActive(chatId)) return extra.reply('❌ Aucune partie en cours.');
      gs.end(chatId);
      return extra.reply('🛑 *Partie terminée !* Merci d\'avoir joué 🎮');
    }
  },
  { name: 'rejoindre', aliases: ['join','participer'], category: 'general', description: 'Rejoindre la partie',
    execute: async (sock, msg, args, extra) => {
      const chatId = msg.key.remoteJid;
      const senderJid = msg.key.participant || msg.key.remoteJid;
      if (!gs.isActive(chatId)) return extra.reply('❌ Aucune partie en cours.');
      const s = gs.get(chatId);
      if (s.turnMode !== 'auto') return extra.reply('❌ Mode manuel — pas besoin de rejoindre.');
      const name = args.join(' ') || senderJid.split('@')[0].split(':')[0];
      const added = gs.addPlayer(chatId, senderJid, name);
      return extra.reply(added ? `✅ *${name}* a rejoint ! (${s.players.length} joueur${s.players.length>1?'s':''})` : '✅ Tu es déjà dans la partie !');
    }
  }
];
