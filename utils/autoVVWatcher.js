/**
 * utils/autoVVWatcher.js
 * Programme simple, sans exception :
 *
 * À chaque NOUVEAU_MESSAGE reçu :
 *   SI le message contient un média (photo/vidéo) :
 *     SI l'attribut "Vue Unique" est activé :
 *       1. Télécharger le fichier brut depuis les serveurs WhatsApp
 *       2. Désactiver l'attribut Vue Unique sur la copie locale
 *       3. Sauvegarder temporairement dans Images_Sauvegardees/
 *       4. Renvoyer le fichier décodé vers "Vous" et vers Telegram
 *       5. Supprimer le fichier temporaire (disque éphémère sur Render)
 */
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const tg = require('./telegram');
const { resolvePhoneNumber } = require('./resolveNumber');
const autoVVStore = require('./autoVVStore');

const SAVE_DIR = path.join(__dirname, '..', 'Images_Sauvegardees');

function normJid(jid) {
  if (!jid) return '';
  const [user, domain] = String(jid).split('@');
  return user.split(':')[0] + (domain ? '@' + domain : '');
}

/**
 * Détecte si le message contient un média en vue unique.
 * downloadMediaMessage gère lui-même le déballage (viewOnceMessageV2, etc.)
 * donc on ne fait ici QUE la détection, pas d'extraction manuelle.
 */
function findViewOnceMedia(msg) {
  const m = msg?.message;
  if (!m) return null;

  // Les 3 formats possibles d'enveloppe "vue unique"
  const content = m.viewOnceMessageV2?.message
    || m.viewOnceMessageV2Extension?.message
    || m.viewOnceMessage?.message
    || m;

  if (content.imageMessage?.viewOnce) return { type: 'image', node: content.imageMessage };
  if (content.videoMessage?.viewOnce) return { type: 'video', node: content.videoMessage };
  // Certains clients mettent le flag directement au niveau racine sans enveloppe
  if (m.imageMessage?.viewOnce) return { type: 'image', node: m.imageMessage };
  if (m.videoMessage?.viewOnce) return { type: 'video', node: m.videoMessage };

  return null;
}

/**
 * Point d'entrée : appelé pour CHAQUE message entrant depuis index.js.
 */
async function watch(sock, msg) {
  try {
    const from = msg.key.remoteJid;
    if (!from || msg.key.fromMe) return;
    if (from.endsWith('@g.us')) return; // discussions privées uniquement (comme /autovv)
    if (!autoVVStore.isEnabled(normJid(from))) return;

    const media = findViewOnceMedia(msg);
    if (!media) return;

    // ── 1. Téléchargement immédiat, appel direct sans clone ni délai ──
    const buffer = await downloadMediaMessage(
      msg,
      'buffer',
      {},
      { reuploadRequest: sock.updateMediaMessage }
    );

    // ── 2. Copie locale avec l'attribut Vue Unique désactivé ──
    const node = { ...media.node, viewOnce: false };
    const caption = node.caption || '';

    // ── 3. Sauvegarde temporaire ──
    if (!fs.existsSync(SAVE_DIR)) fs.mkdirSync(SAVE_DIR, { recursive: true });
    const ext = media.type === 'image' ? 'jpg' : 'mp4';
    const filename = `vv_${Date.now()}.${ext}`;
    const filepath = path.join(SAVE_DIR, filename);
    fs.writeFileSync(filepath, buffer);

    // ── 4. Renvoi vers "Vous" + Telegram ──
    const selfJid = String(sock.user.id).split(':')[0] + '@s.whatsapp.net';
    const senderNum = await resolvePhoneNumber(sock, from, msg.key);
    const infoLine = `👁️ *Vue unique (auto)* de *+${senderNum}*`;
    const fullCaption = caption ? `${infoLine}\n\n📝 ${caption}` : infoLine;

    if (media.type === 'image') {
      await sock.sendMessage(selfJid, { image: buffer, caption: fullCaption }, {});
      tg.sendMedia(buffer, 'image', fullCaption, filename).catch(() => {});
    } else {
      await sock.sendMessage(selfJid, { video: buffer, caption: fullCaption }, {});
      tg.sendMedia(buffer, 'video', fullCaption, filename).catch(() => {});
    }

    // ── 5. Nettoyage (disque éphémère sur Render) ──
    fs.unlink(filepath, () => {});
  } catch (e) {
    console.error('[autoVVWatcher]', e.message);
    try {
      const selfJid = String(sock.user.id).split(':')[0] + '@s.whatsapp.net';
      await sock.sendMessage(selfJid, {
        text: '❌ Auto-VV : échec du téléchargement.\n_' + e.message + '_'
      }, {});
    } catch {}
  }
}

module.exports = { watch };
