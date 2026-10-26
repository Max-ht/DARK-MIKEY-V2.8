/**
 * /menu - DARK-MIKEY (style original avec flèches)
 */
const config = require('../../config');
const { getUptime } = require('../../utils/helpers');
const fs   = require('fs');
const path = require('path');

module.exports = {
  name: 'menu',
  aliases: ['aide', 'commandes', 'help', 'commands', 'list'],
  category: 'general',
  description: 'Afficher toutes les commandes disponibles',
  usage: '/menu',

  async execute(sock, msg, args, extra) {
    const chatId   = msg.key.remoteJid;
    const p        = config.prefix;
    const name     = msg.pushName || 'ami(e)';
    const uptime   = getUptime ? getUptime() : '-';
    const owner    = Array.isArray(config.ownerNumber) ? config.ownerNumber[0] : config.ownerNumber || '?';

    const header = `┌──────────────────────┐
│  🤖  *DARK-MIKEY*  🤖  │
└──────────────────────┘

👋 Bonjour *${name}* !
👑 Propriétaire : *${config.ownerName || 'Mikey'}*
⚡ Préfixe : *${p}*  ·  ⏱ *${uptime}*

━━━━━━━━━━━━━━━━━━━━━━`;

    const sections = [
      { emoji: '🌐', title: 'COMMANDES GÉNÉRALES', cmds: [
        'menu','ping','vv / bb','autovv','sticker','take','save / send',
        'jeu','prochain','fin','rejoindre',
      ]},
      { emoji: '🤖', title: 'COMMANDES IA', cmds: [
        'ai','gptimage','imagine',
      ]},
      { emoji: '🎵', title: 'MÉDIAS & TÉLÉCHARGEMENTS', cmds: [
        'tiktok','ytmp4','ytmp3','twitter','instagram','facebook','spotify','pinterest',
      ]},
      { emoji: '🛡️', title: 'COMMANDES ADMIN', cmds: [
        'antibadword','antigroupmention','antigroupstatus','antilink','antisticker','antitag',
        'antidelete','antispam','mute','unmute','kick','ban','promote','demote',
        'warn','warnadd','warnlist','warnreset','setwelcome','setgoodbye',
        'setdesc','setname','setppgc','lock','unlock','chatbot',
      ]},
      { emoji: '🔧', title: 'COMMANDES UTILITAIRES', cmds: [
        'meteo','raccourcir','google','rappel','traduire','calc',
        'qr','simage','ssweb','tts','uptime',
      ]},
      { emoji: '👑', title: 'COMMANDES PROPRIÉTAIRE', cmds: [
        'autovv','antidelete','setpp','update','restart','setbotname','setprefix',
      ]},
    ];

    let body = '';
    for (const sec of sections) {
      body += `\n\n${sec.emoji} *${sec.title}*\n`;
      for (const cmd of sec.cmds) {
        body += `→ ${p}${cmd}\n`;
      }
      body += '━━━━━━━━━━━━━━━━━━━━━━';
    }

    const footer = `\n\n_Pour l'aide d'une commande :_\n_${p}help <commande>_`;
    const fullText = header + body + footer;

    const imagePath = path.join(__dirname, '../../utils/bot_image.jpg');
    try {
      const image = fs.readFileSync(imagePath);
      await sock.sendMessage(chatId, { image, caption: fullText }, { quoted: msg });
    } catch {
      await sock.sendMessage(chatId, { text: fullText }, { quoted: msg });
    }
  }
};
