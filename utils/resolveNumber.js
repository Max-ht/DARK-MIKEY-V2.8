/**
 * utils/resolveNumber.js
 * Résout un JID (potentiellement un @lid, identifiant interne WhatsApp)
 * vers le vrai numéro de téléphone, quand c'est possible.
 *
 * WhatsApp masque parfois le numéro derrière un LID (Linked ID). Baileys v7
 * expose plusieurs sources pour retrouver le vrai numéro, par ordre de fiabilité :
 *   1. Les champs alternatifs déjà présents dans la clé du message
 *      (remoteJidAlt, participantPn, senderPn) — le plus rapide, souvent déjà là
 *   2. Le store interne de correspondance LID<->numéro de Baileys
 *      (sock.signalRepository.lidMapping.getPNForLID)
 *   3. Repli : affichage du LID tronqué si rien n'est disponible
 *      (WhatsApp ne fournit pas toujours cette correspondance, notamment
 *      pour d'anciens messages — ce n'est pas un bug de notre côté)
 */

/**
 * @param {object} sock   Le socket Baileys actif
 * @param {string} jid    Le JID à résoudre (ex: "123456789@lid")
 * @param {object} [msgKey] La clé du message (msg.key), si disponible —
 *                          permet de trouver remoteJidAlt/participantPn/senderPn
 * @returns {Promise<string>} Le numéro affichable (sans indicatif +)
 */
async function resolvePhoneNumber(sock, jid, msgKey) {
  if (!jid) return 'inconnu';

  // Pas un LID : c'est déjà un numéro normal
  if (!String(jid).includes('@lid')) {
    return String(jid).split('@')[0].split(':')[0];
  }

  // 1. Champs alternatifs déjà fournis par WhatsApp dans la clé du message
  const alt = msgKey?.remoteJidAlt || msgKey?.participantPn || msgKey?.senderPn;
  if (alt) {
    return String(alt).split('@')[0].split(':')[0];
  }

  // 2. Store de correspondance LID<->numéro de Baileys
  try {
    const pn = await sock?.signalRepository?.lidMapping?.getPNForLID?.(jid);
    if (pn) return String(pn).split('@')[0].split(':')[0];
  } catch (e) {
    console.error('[resolveNumber] getPNForLID a échoué:', e.message);
  }

  // 3. Repli : LID tronqué (vrai numéro non disponible côté WhatsApp)
  const raw = String(jid).split('@')[0].split(':')[0];
  return raw.slice(-6) + '… (numéro masqué par WhatsApp)';
}

module.exports = { resolvePhoneNumber };
