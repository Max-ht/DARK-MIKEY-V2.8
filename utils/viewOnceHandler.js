/**
 * utils/viewOnceHandler.js — V2.3
 * Fusion : leur version (ephemeral + JSON clone + downloadContentFromMessage en 1er)
 * + la nôtre (store per-chat, Telegram, LID display)
 * Bug corrigé : redéclaration de mediaInfo → renommé en `mi`
 */
const { downloadContentFromMessage, downloadMediaMessage } = require('@whiskeysockets/baileys');
const tg = require('./telegram');
const { resolvePhoneNumber } = require('./resolveNumber');

// ── Détection ────────────────────────────────────────────────────────────────
function isViewOnce(msg) {
  const m = msg?.message;
  if (!m) return false;
  // Déballage préalable des enveloppes éphémères / associées
  const inner = m.ephemeralMessage?.message
    || m.associatedChildMessage?.message
    || m;
  return !!(
    inner.viewOnceMessageV2 ||
    inner.viewOnceMessageV2Extension ||
    inner.viewOnceMessage ||
    inner?.imageMessage?.viewOnce ||
    inner?.videoMessage?.viewOnce ||
    inner?.audioMessage?.viewOnce
  );
}

// ── Déballage récursif ────────────────────────────────────────────────────────
function unwrap(m) {
  if (!m) return m;
  if (m.ephemeralMessage?.message)       return unwrap(m.ephemeralMessage.message);
  if (m.associatedChildMessage?.message) return unwrap(m.associatedChildMessage.message);
  if (m.viewOnceMessageV2Extension)      return m.viewOnceMessageV2Extension.message || m;
  if (m.viewOnceMessageV2)               return m.viewOnceMessageV2.message || m;
  if (m.viewOnceMessage)                 return m.viewOnceMessage.message || m;
  return m;
}

// ── Recherche du type média ───────────────────────────────────────────────────
function findMedia(msgObj) {
  if (!msgObj) return { actualMsg: null, mtype: null };
  const types = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage'];
  for (const t of types) {
    if (msgObj[t]) return { actualMsg: msgObj, mtype: t };
  }
  return { actualMsg: null, mtype: null };
}

// ── Téléchargement AUTO (vue unique reçue) ────────────────────────────────────
async function downloadAuto(sock, rawMsg) {
  // Clone profond pour éviter les collisions mémoire de Baileys
  const clone = JSON.parse(JSON.stringify(rawMsg.message));
  const unwrapped = unwrap(clone);
  const { actualMsg, mtype } = findMedia(unwrapped);

  // Méthode 1 : flux direct (même méthode que /vv — la plus fiable)
  if (actualMsg && mtype) {
    const mi = actualMsg[mtype];
    if (mi?.mediaKey?.length) {
      try {
        const stream = await downloadContentFromMessage(mi, mtype.replace('Message', ''));
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const buf = Buffer.concat(chunks);
        if (buf.length > 0) return buf;
      } catch (e) {
        console.error('[VH] downloadContentFromMessage failed:', e.message);
      }
    }
  }

  // Méthode 2 : reupload via Baileys (fallback)
  try {
    const buf = await downloadMediaMessage(
      rawMsg, 'buffer', {},
      { reuploadRequest: sock.updateMediaMessage }
    );
    if (buf && buf.length > 0) return buf;
  } catch (e) {
    console.error('[VH] downloadMediaMessage failed:', e.message);
  }

  throw new Error('Média expiré ou indisponible sur les serveurs WhatsApp.');
}

// ── Téléchargement MANUEL (/vv) ───────────────────────────────────────────────
async function downloadManual(quotedMsgObj) {
  const unwrapped = unwrap(quotedMsgObj);
  const { actualMsg, mtype } = findMedia(unwrapped);
  if (!actualMsg || !mtype) throw new Error('Type de média non reconnu.');
  const mi = actualMsg[mtype];
  const stream = await downloadContentFromMessage(mi, mtype.replace('Message', ''));
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return { buffer: Buffer.concat(chunks), actualMsg, mtype };
}

// ── Envoi vers WhatsApp Vous + Telegram ──────────────────────────────────────
async function sendMedia(sock, destJid, buffer, mtype, caption, mi) {
  if (mtype === 'imageMessage') {
    await sock.sendMessage(destJid, { image: buffer, caption }, {});
    tg.sendMedia(buffer, 'image', caption, 'image.jpg').catch(() => {});
  } else if (mtype === 'videoMessage') {
    await sock.sendMessage(destJid, { video: buffer, caption }, {});
    tg.sendMedia(buffer, 'video', caption, 'video.mp4').catch(() => {});
  } else if (mtype === 'audioMessage') {
    const ptt = mi?.ptt ?? true;
    await sock.sendMessage(destJid, { audio: buffer, ptt, mimetype: 'audio/ogg; codecs=opus' }, {});
    tg.sendText(caption).catch(() => {});
    tg.sendMedia(buffer, 'audio', caption, 'audio.ogg').catch(() => {});
  } else {
    await sock.sendMessage(destJid, {
      document: buffer, caption,
      mimetype: mi?.mimetype || 'application/octet-stream'
    }, {});
    tg.sendMedia(buffer, 'document', caption, 'file').catch(() => {});
  }
}

// ── Point d'entrée principal ──────────────────────────────────────────────────
async function processAndForward(sock, rawMsg, quotedMsgObj, senderJid, sourceChat, groupName, originalCaption) {
  const selfJid  = String(sock.user.id).split(':')[0] + '@s.whatsapp.net';
  const dispNum  = await resolvePhoneNumber(sock, senderJid, rawMsg?.key);
  const where    = groupName ? ('groupe *' + groupName + '*') : 'discussion privée';
  const infoLine = '👁️ *Vue unique* de *+' + dispNum + '* (' + where + ')';
  const caption  = originalCaption ? infoLine + '\n\n📝 ' + originalCaption : infoLine;

  try {
    if (quotedMsgObj) {
      // Mode /vv manuel
      const { buffer, actualMsg, mtype } = await downloadManual(quotedMsgObj);
      await sendMedia(sock, selfJid, buffer, mtype, caption, actualMsg[mtype]);
    } else {
      // Mode auto (autovv)
      const buffer = await downloadAuto(sock, rawMsg);
      const unwrapped = unwrap(rawMsg.message);
      const { mtype } = findMedia(unwrapped);
      const guessedType = mtype || 'imageMessage';
      await sendMedia(sock, selfJid, buffer, guessedType, caption, unwrapped?.[guessedType] || {});
    }
    return true;
  } catch (err) {
    console.error('[VH] Erreur Vue Unique:', err.message);
    await sock.sendMessage(selfJid, {
      text: '❌ ' + infoLine + '\n\n_Erreur : ' + err.message + '_'
    }, {}).catch(() => {});
    return false;
  }
}

module.exports = { isViewOnce, processAndForward, unwrap };
