/**
 * utils/autoVVStore.js - Store en mémoire pour /autovv
 * Normalise les JIDs pour éviter les faux négatifs dus aux suffixes de device.
 */
const enabled = new Set();

function norm(jid) {
  if (!jid) return '';
  const [user, domain] = String(jid).split('@');
  return user.split(':')[0] + (domain ? '@' + domain : '');
}

module.exports = {
  enable:    (jid) => enabled.add(norm(jid)),
  disable:   (jid) => enabled.delete(norm(jid)),
  isEnabled: (jid) => enabled.has(norm(jid)),
  toggle:    (jid) => {
    const n = norm(jid);
    if (enabled.has(n)) { enabled.delete(n); return false; }
    enabled.add(n); return true;
  },
  list: () => [...enabled],
};
