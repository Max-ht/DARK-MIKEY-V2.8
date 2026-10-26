/**
 * /setpp - Changer la photo de profil WhatsApp du bot
 * Réponds à une image avec /setpp
 */
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

module.exports = {
  name: 'setpp',
  aliases: ['setprofil', 'changerpp', 'changerprofil'],
  category: 'owner',
  description: "Changer la photo de profil WhatsApp du bot",
  usage: '/setpp (répondre à une image)',
  ownerOnly: true,

  async execute(sock, msg, args, extra) {
    const chatId = msg.key.remoteJid;
    try {
      const ctx =
        msg.message?.extendedTextMessage?.contextInfo ||
        msg.message?.imageMessage?.contextInfo ||
        Object.values(msg.message || {}).find(v => v?.contextInfo)?.contextInfo;

      const quoted = ctx?.quotedMessage;
      const hasImg = quoted?.imageMessage || msg.message?.imageMessage;

      if (!hasImg) {
        return extra.reply('📌 *Utilisation :* Réponds à une image avec */setpp* pour changer la photo de profil du bot.');
      }

      let buffer;
      if (msg.message?.imageMessage) {
        buffer = await downloadMediaMessage(msg, 'buffer', {});
      } else {
        const fakeMsg = {
          key: { remoteJid: ctx.remoteJid || chatId, id: ctx.stanzaId, fromMe: false },
          message: quoted
        };
        buffer = await downloadMediaMessage(fakeMsg, 'buffer', {});
      }

      await sock.updateProfilePicture(sock.user.id, buffer);
      await extra.reply('✅ *Photo de profil mise à jour avec succès !*');
    } catch (err) {
      console.error('[setpp]', err.message);
      await extra.reply(`❌ Impossible de changer la photo de profil.\n_Erreur : ${err.message}_`);
    }
  }
};
