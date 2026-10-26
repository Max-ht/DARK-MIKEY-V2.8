/**
 * /savestatus /save /send - Sauvegarder un statut WhatsApp
 * Réponds à un statut avec cette commande.
 */
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

module.exports = {
  name: 'savestatus',
  aliases: ['save', 'send', 'statut', 'savestatus'],
  category: 'general',
  description: "Sauvegarde un statut WhatsApp (réponds à un statut)",
  usage: '/save (répondre à un statut)',
  ownerOnly: true,

  async execute(sock, msg, args, extra) {
    const chatId = msg.key.remoteJid;
    try {
      // Chercher le contextInfo dans tous les types de message possibles
      const msgContent = msg.message || {};
      const ctx =
        msgContent.extendedTextMessage?.contextInfo ||
        msgContent.imageMessage?.contextInfo ||
        msgContent.videoMessage?.contextInfo ||
        msgContent.audioMessage?.contextInfo ||
        msgContent.buttonsResponseMessage?.contextInfo ||
        Object.values(msgContent).find(v => v?.contextInfo)?.contextInfo;

      if (!ctx?.quotedMessage) {
        return extra.reply('📌 *Utilisation :* Réponds à un statut WhatsApp avec */save*\n\n_Ouvre les statuts, appuie sur Répondre, tape /save_');
      }

      const quoted = ctx.quotedMessage;
      const remoteJid = ctx.remoteJid || 'status@broadcast';
      const stanzaId = ctx.stanzaId || '';

      // Texte du statut
      const text = quoted.conversation
        || quoted.extendedTextMessage?.text
        || quoted.imageMessage?.caption
        || quoted.videoMessage?.caption
        || '';

      // Trouver le type média
      const mediaTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage'];
      const mtype = mediaTypes.find(t => quoted[t]);

      if (!mtype) {
        // Statut texte uniquement
        if (!text) return extra.reply('❌ Ce statut ne contient aucun contenu récupérable.');
        await sock.sendMessage(chatId, {
          text: `📋 *Statut sauvegardé :*\n\n${text}`
        }, { quoted: msg });
        return extra.reply('✅ Statut texte sauvegardé !');
      }

      // Reconstruire le message pour le téléchargement
      const fakeMsg = {
        key: { remoteJid, id: stanzaId, fromMe: false, participant: ctx.participant },
        message: quoted
      };

      const buffer = await downloadMediaMessage(
        fakeMsg, 'buffer', {},
        { reuploadRequest: sock.updateMediaMessage }
      );

      const caption = `📸 *Statut sauvegardé*${text ? '\n\n' + text : ''}`;

      if (mtype === 'imageMessage') {
        await sock.sendMessage(chatId, { image: buffer, caption }, { quoted: msg });
      } else if (mtype === 'videoMessage') {
        await sock.sendMessage(chatId, { video: buffer, caption }, { quoted: msg });
      } else if (mtype === 'audioMessage') {
        await sock.sendMessage(chatId, { audio: buffer, ptt: false, mimetype: 'audio/mp4' }, { quoted: msg });
      } else {
        await sock.sendMessage(chatId, {
          document: buffer,
          mimetype: quoted[mtype]?.mimetype || 'application/octet-stream',
          fileName: 'statut'
        }, { quoted: msg });
      }

      await sock.sendMessage(chatId, { text: '✅ Statut sauvegardé avec succès !' }, {});
    } catch (err) {
      console.error('[savestatus]', err.message);
      await extra.reply(`❌ Impossible de sauvegarder ce statut.\n\n_Assure-toi de répondre directement à un statut (pas à un message normal)._`);
    }
  }
};
