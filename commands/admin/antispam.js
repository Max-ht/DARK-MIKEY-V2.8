/**
 * /antispam - Activer/désactiver la protection anti-spam dans un groupe
 * (bloque les liens d'invitation, les messages flood, les liens en masse)
 */
module.exports = {
  name: 'antispam',
  aliases: ['nospam', 'antiflood'],
  category: 'admin',
  description: 'Active/désactive la protection anti-spam dans le groupe',
  usage: '/antispam [on|off]',
  groupOnly: true,
  adminOnly: true,

  async execute(sock, msg, args, extra) {
    const { default: database } = await Promise.resolve().then(() => require('../../database'));
    const chatId = msg.key.remoteJid;
    const settings = database.getGroupSettings(chatId);
    const arg = (args[0] || '').toLowerCase();

    let enabled;
    if (arg === 'on' || arg === 'activer') enabled = true;
    else if (arg === 'off' || arg === 'desactiver' || arg === 'désactiver') enabled = false;
    else enabled = !settings.antispam;

    settings.antispam = enabled;
    database.updateGroupSettings(chatId, { antispam: enabled });

    const emoji = enabled ? '🛡️' : '🔓';
    const état = enabled ? 'ACTIVÉ' : 'DÉSACTIVÉ';
    await extra.reply(
      `${emoji} *Anti-spam ${état}*\n\n` +
      (enabled
        ? '• Liens d\'invitation WhatsApp bloqués\n• Messages répétés bloqués\n• Flood détecté'
        : 'La protection anti-spam est désactivée.')
    );
  }
};
