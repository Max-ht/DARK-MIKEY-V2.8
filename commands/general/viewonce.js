/**
 * /vv /viewonce /bb - Révèle un message à vue unique
 * Accessible à tous (pas ownerOnly)
 *
 * Ce même code est aussi appelé en arrière-plan par utils/autoVVWatcher.js
 * (Système 3 du plan autovv) avec un faux message de réponse : le chemin
 * d'exécution est strictement identique, manuel ou automatique.
 */
const { jidNormalizedUser } = require('@whiskeysockets/baileys');
const { processAndForward, unwrap } = require('../../utils/viewOnceHandler');

function hasViewOnce(m) {
  if (!m) return false;
  // Déballe les enveloppes éphémères avant de tester (cohérent avec le Système 2)
  const inner = unwrap(m);
  return !!(
    inner.viewOnceMessageV2 ||
    inner.viewOnceMessageV2Extension ||
    inner.viewOnceMessage ||
    inner?.imageMessage?.viewOnce ||
    inner?.videoMessage?.viewOnce ||
    inner?.audioMessage?.viewOnce
  );
}

module.exports = {
  name: 'viewonce',
  aliases: ['vv', 'bb', 'vueunique', 'read'],
  category: 'general',
  description: "Révèle un message à vue unique → envoyé dans Vous + Telegram",
  usage: '/vv (répondre à un message vue unique)',

  async execute(sock, msg) {
    const selfJid = jidNormalizedUser(sock.user.id);
    const sourceChat = msg.key.remoteJid;

    const ctx =
      msg.message?.extendedTextMessage?.contextInfo ||
      msg.message?.imageMessage?.contextInfo ||
      msg.message?.videoMessage?.contextInfo ||
      msg.message?.audioMessage?.contextInfo ||
      msg.message?.buttonsResponseMessage?.contextInfo;

    if (!ctx?.quotedMessage || !ctx?.stanzaId) {
      return sock.sendMessage(selfJid, {
        text: '📌 Réponds à un message *vue unique* avec */vv* pour le révéler.'
      }, {});
    }

    const quotedMsgRaw = ctx.quotedMessage;

    if (!hasViewOnce(quotedMsgRaw)) {
      return sock.sendMessage(selfJid, {
        text: "❌ Ce message n'est pas un message à vue unique."
      }, {});
    }

    // ── Correction du numéro expéditeur ──
    let senderJid;
    if (sourceChat.endsWith('@g.us')) {
      // Groupe : l'expéditeur est dans ctx.participant
      senderJid = ctx.participant || ctx.remoteJid || sourceChat;
    } else {
      // Privé : l'expéditeur est TOUJOURS l'autre personne = sourceChat
      senderJid = sourceChat;
    }

    let groupName = null;
    if (sourceChat.endsWith('@g.us')) {
      try { const meta = await sock.groupMetadata(sourceChat); groupName = meta.subject; }
      catch { groupName = 'Groupe'; }
    }

    const unwrapped = unwrap(quotedMsgRaw);

    let originalCaption = '';
    for (const t of ['imageMessage','videoMessage','audioMessage','documentMessage']) {
      if (unwrapped[t]?.caption) { originalCaption = unwrapped[t].caption; break; }
    }

    try {
      await processAndForward(sock, msg, quotedMsgRaw, senderJid, sourceChat, groupName, originalCaption);
    } catch (err) {
      console.error('[/vv]', err.message);
      await sock.sendMessage(selfJid, { text: '❌ Erreur : ' + err.message }, {});
    }
  }
};
