/**
 * /rappel - Définir un rappel
 */
const rappelStore = require('../../utils/rappelStore');

module.exports = {
  name: 'rappel',
  aliases: ['reminder', 'remind', 'alarme'],
  category: 'utility',
  description: 'Définir un rappel (ex: /rappel 30m Appeler Max)',
  usage: '/rappel <délai> <message>',

  async execute(sock, msg, args, extra) {
    const chatId = msg.key.remoteJid;

    // /rappel list
    if (args[0]?.toLowerCase() === 'list' || args[0]?.toLowerCase() === 'liste') {
      const list = rappelStore.list(chatId);
      if (!list.length) return extra.reply('📋 Aucun rappel actif dans cette discussion.');
      let text = '📋 *Rappels actifs :*\n\n';
      for (const r of list) {
        const remaining = Math.max(0, r.expiresAt - Date.now());
        const m = Math.floor(remaining / 60000);
        text += `• *#${r.id}* : ${r.text} (dans ${m} min)\n`;
      }
      return extra.reply(text);
    }

    // /rappel annuler <id>
    if (args[0]?.toLowerCase() === 'annuler' && args[1]) {
      const id = parseInt(args[1]);
      if (rappelStore.cancel(id)) return extra.reply(`✅ Rappel *#${id}* annulé.`);
      return extra.reply(`❌ Rappel *#${id}* introuvable.`);
    }

    // /rappel <délai> <texte>
    const delayStr = args[0];
    const text = args.slice(1).join(' ').trim();
    if (!delayStr || !text) {
      return extra.reply(
        '❌ *Usage :*\n' +
        '• `/rappel 30m Appeler Max`\n' +
        '• `/rappel 2h Réunion`\n' +
        '• `/rappel 1j Anniversaire`\n' +
        '• `/rappel liste` — voir les rappels\n' +
        '• `/rappel annuler <id>` — annuler\n\n' +
        '⏱ Unités : s, m, h, j'
      );
    }

    const delayMs = rappelStore.parseDelay(delayStr);
    if (!delayMs || delayMs < 5000 || delayMs > 7 * 24 * 3600 * 1000) {
      return extra.reply('❌ Délai invalide. Min : 5s, Max : 7j. Ex : 30m, 2h, 1j');
    }

    const id = rappelStore.add(chatId, delayMs, text, async (rid, jid, t) => {
      try {
        await sock.sendMessage(jid, {
          text: `⏰ *RAPPEL #${rid}*\n\n📌 ${t}`
        });
      } catch (e) { console.error('[rappel callback]', e.message); }
    });

    const mins = Math.round(delayMs / 60000);
    const display = mins < 60 ? `${mins} min` : `${Math.round(mins / 60 * 10) / 10} h`;
    await extra.reply(`✅ *Rappel #${id} défini !*\n⏱ Dans ${display}\n📌 ${text}`);
  }
};
