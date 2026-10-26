/**
 * WhatsApp MD Bot - Main Entry Point (Optimized for Cloud Deployment)
 */
process.env.PUPPETEER_SKIP_DOWNLOAD = 'true';
process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = 'true';
process.env.PUPPETEER_CACHE_DIR = process.env.PUPPETEER_CACHE_DIR || '/tmp/puppeteer_cache_disabled';

const { initializeTempSystem } = require('./utils/tempManager');
const { startCleanup } = require('./utils/cleanup');
initializeTempSystem();
startCleanup();

// --- 1. SERVEUR WEB INTÉGRÉ POUR LE DÉPLOIEMENT CLOUD (Render, Koyeb, Heroku) ---
const http = require('http');
const PORT = process.env.PORT || 8000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('DARK-MIKEY Bot is online and running 24/7!\n');
}).listen(PORT, () => {
    console.log(`🌐 Web server is running on port ${PORT} (Ready for UptimeRobot/Cloud)`);
});

const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

const forbiddenPatternsConsole = [
  'closing session', 'closing open session', 'sessionentry', 'prekey bundle',
  'pendingprekey', '_chains', 'registrationid', 'currentratchet', 'chainkey',
  'ratchet', 'signal protocol', 'ephemeralkeypair', 'indexinfo', 'basekey'
];

console.log = (...args) => {
  const message = args.map(a => typeof a === 'string' ? a : typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ').toLowerCase();
  if (!forbiddenPatternsConsole.some(pattern => message.includes(pattern))) originalConsoleLog.apply(console, args);
};
console.error = (...args) => {
  const message = args.map(a => typeof a === 'string' ? a : typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ').toLowerCase();
  if (!forbiddenPatternsConsole.some(pattern => message.includes(pattern))) originalConsoleError.apply(console, args);
};
console.warn = (...args) => {
  const message = args.map(a => typeof a === 'string' ? a : typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ').toLowerCase();
  if (!forbiddenPatternsConsole.some(pattern => message.includes(pattern))) originalConsoleWarn.apply(console, args);
};

const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const readline = require('readline');
const config = require('./config');
const handler = require('./handler');
const autoVVStore = require('./utils/autoVVStore');
const antiDeleteStore = require('./utils/antiDeleteStore');
const autoVVWatcher = require('./utils/autoVVWatcher');
const { resolvePhoneNumber } = require('./utils/resolveNumber');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const os = require('os');

// Fonction pour poser une question dans la console
const question = (text) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(text, (answer) => {
      rl.close();
      resolve(answer);
  }));
};

function cleanupPuppeteerCache() {
  try {
    const home = os.homedir();
    const cacheDir = path.join(home, '.cache', 'puppeteer');
    if (fs.existsSync(cacheDir)) {
      console.log('🧹 Removing Puppeteer cache at:', cacheDir);
      fs.rmSync(cacheDir, { recursive: true, force: true });
    }
  } catch (err) {}
}

const store = {
  messages: new Map(),
  maxPerChat: 20,
  bind: (ev) => {
    ev.on('messages.upsert', ({ messages }) => {
      for (const msg of messages) {
        if (!msg.key?.id) continue;
        const jid = msg.key.remoteJid;
        if (!store.messages.has(jid)) store.messages.set(jid, new Map());
        const chatMsgs = store.messages.get(jid);
        chatMsgs.set(msg.key.id, msg);
        if (chatMsgs.size > store.maxPerChat) {
          const oldestKey = chatMsgs.keys().next().value;
          chatMsgs.delete(oldestKey);
        }
      }
    });
  },
  loadMessage: async (jid, id) => store.messages.get(jid)?.get(id) || null
};

const processedMessages = new Set();
setInterval(() => { processedMessages.clear(); }, 5 * 60 * 1000);

const createSuppressedLogger = (level = 'silent') => {
  let logger;
  try {
    logger = pino({ level });
  } catch (err) { logger = pino({ level }); }
  const originalInfo = logger.info.bind(logger);
  logger.info = (...args) => {
    const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ').toLowerCase();
    if (!forbiddenPatternsConsole.some(pattern => msg.includes(pattern))) originalInfo(...args);
  };
  logger.debug = () => { }; 
  logger.trace = () => { };
  return logger;
};

// Main connection function
async function startBot() {
  const sessionFolder = `./${config.sessionName}`;
  const sessionFile = path.join(sessionFolder, 'creds.json');

  const SESSION_HEADERS = ['DARK-MIKEY', 'KnightBot'];
  if (config.sessionID && SESSION_HEADERS.some(h => config.sessionID.startsWith(`${h}!`))) {
    try {
      const [header, b64data] = config.sessionID.split('!');
      const cleanB64 = b64data.replace('...', '');
      const compressedData = Buffer.from(cleanB64, 'base64');
      const decompressedData = zlib.gunzipSync(compressedData);
      if (!fs.existsSync(sessionFolder)) fs.mkdirSync(sessionFolder, { recursive: true });
      fs.writeFileSync(sessionFile, decompressedData, 'utf8');
      console.log('📡 Session : 🔑 Retrieved from SESSION_ID');
    } catch (e) {
      console.error('📡 Session : ❌ Error processing session:', e.message);
    }
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
  const { version } = await fetchLatestBaileysVersion();
  const suppressedLogger = createSuppressedLogger('silent');

  const sock = makeWASocket({
    version,
    logger: suppressedLogger,
    printQRInTerminal: false, // QR code désactivé, on utilise le code de liaison
    browser: Browsers.ubuntu('Chrome'), // Ubuntu masque mieux la signature pour le pairing
    auth: state,
    syncFullHistory: false,
    downloadHistory: false,
    markOnlineOnConnect: false,
    getMessage: async () => undefined
  });

  store.bind(sock.ev);

  // --- 2. SYSTÈME DE PAIRING CODE INTÉGRÉ (Générateur de Session) ---
  if (!sock.authState.creds.registered) {
    setTimeout(async () => {
        let phoneNumber = process.env.OWNER_NUMBER || (config.ownerNumber && config.ownerNumber[0]);
        
        // Nettoie le numéro pour ne garder que les chiffres
        if (phoneNumber) phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

        if (!phoneNumber) {
            console.log("\n⚠️ Aucun 'OWNER_NUMBER' trouvé dans les variables d'environnement.");
            phoneNumber = await question('📱 Entre ton numéro WhatsApp (avec indicatif, sans + ni espaces, ex: 509...) : ');
        }

        console.log(`\n⏳ Demande du code de liaison pour le numéro : +${phoneNumber}...`);
        
        try {
            let code = await sock.requestPairingCode(phoneNumber);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(`\n=============================================================`);
            console.log(`🔑 TON CODE DE LIAISON (PAIRING CODE) EST : ${code}`);
            console.log(`=============================================================`);
            console.log(`📱 Sur ton téléphone, ouvre WhatsApp.`);
            console.log(`📱 Va dans "Appareils connectés" > "Lier un appareil".`);
            console.log(`📱 Choisis "Lier avec un numéro de téléphone" et entre ce code.\n`);
        } catch (err) {
            console.error('❌ Erreur lors de la génération du code de liaison:', err);
        }
    }, 3000);
  }

  let lastActivity = Date.now();
  const INACTIVITY_TIMEOUT = 30 * 60 * 1000;
  sock.ev.on('messages.upsert', () => { lastActivity = Date.now(); });
  
  const watchdogInterval = setInterval(async () => {
    if (Date.now() - lastActivity > INACTIVITY_TIMEOUT && sock.ws.readyState === 1) {
      console.log('⚠️ No activity detected. Forcing reconnect...');
      await sock.end(undefined, undefined, { reason: 'inactive' });
      clearInterval(watchdogInterval);
      setTimeout(() => startBot(), 5000);
    }
  }, 5 * 60 * 1000);

  sock.ev.on('connection.update', (update) => {
    const { connection } = update;
    if (connection === 'open') lastActivity = Date.now();
    else if (connection === 'close') clearInterval(watchdogInterval);
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode === 515 || statusCode === 503 || statusCode === 408) {
        console.log(`⚠️ Connection closed (${statusCode}). Reconnecting...`);
      } else {
        console.log('Connection closed. Reconnecting:', shouldReconnect);
      }
      if (shouldReconnect) setTimeout(() => startBot(), 3000);
    } else if (connection === 'open') {
      console.log('\n✅ Bot connected successfully!');
      console.log(`📱 Bot Number: ${sock.user.id.split(':')[0]}`);
      console.log(`🤖 Bot Name: ${config.botName}`);
      console.log(`⚡ Prefix: ${config.prefix}\n`);
      if (config.autoBio) await sock.updateProfileStatus(`${config.botName} | Active 24/7`);
      handler.initializeAntiCall(sock);
    }
  });

  sock.ev.on('creds.update', saveCreds);

  const isSystemJid = (jid) => {
    if (!jid) return true;
    return jid.includes('@broadcast') || jid.includes('status.broadcast') || jid.includes('@newsletter');
  };

  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message || !msg.key?.id) continue;
      const from = msg.key.remoteJid;
      if (!from || isSystemJid(from)) continue;
      
      const msgId = msg.key.id;
      if (processedMessages.has(msgId)) continue;
      
      if (msg.messageTimestamp && Date.now() - (msg.messageTimestamp * 1000) > (5 * 60 * 1000)) continue;
      processedMessages.add(msgId);

      if (msg.key && msg.key.id) {
        if (!store.messages.has(from)) store.messages.set(from, new Map());
        const chatMsgs = store.messages.get(from);
        chatMsgs.set(msg.key.id, msg);
      }

      // ── Auto-VV : téléchargement direct du média vue unique dès réception ──
      autoVVWatcher.watch(sock, msg).catch(e => console.error('[autovv watch]', e.message));

      // ── Anti-delete : détection des suppressions "pour tout le monde" ──
      let _hasAntiDelete = false;
      try { _hasAntiDelete = antiDeleteStore.hasAny(); } catch (e) { console.error('[anti-delete check]', e.message); }
      if (_hasAntiDelete) {
        const proto = msg.message?.protocolMessage;
        const isRevoke = !!proto?.key?.id && (proto.type === 0 || String(proto.type) === 'REVOKE'); // REVOKE = 0 dans le protocole WhatsApp
        if (isRevoke && antiDeleteStore.isEnabled(from)) {
          const selfJid = String(sock.user.id).split(':')[0] + '@s.whatsapp.net';
          const deletedId = proto.key?.id;
          const deletedFromMe = proto.key?.fromMe;
          if (deletedId) {
            (async () => {
              try {
                // Récupérer le message depuis le cache
                const chatMsgs = store.messages.get(from);
                const cached = chatMsgs?.get(deletedId);
                if (!cached?.message) return;

                const senderJid = cached.key.participant || (cached.key.fromMe ? selfJid : from);
                const senderNum = await resolvePhoneNumber(sock, senderJid, cached.key);

                let groupPrefix = '';
                if (from.endsWith('@g.us')) {
                  try {
                    const meta = await sock.groupMetadata(from);
                    groupPrefix = '👥 *' + (meta?.subject || 'Groupe') + '*\n';
                  } catch {}
                }

                const infoLine = '🗑️ *Message supprimé*\n' + groupPrefix + '📱 De : +' + senderNum;
                const content = cached.message;
                const text = content.conversation
                  || content.extendedTextMessage?.text
                  || content.imageMessage?.caption
                  || content.videoMessage?.caption
                  || '';
                const mtype = ['imageMessage','videoMessage','audioMessage','stickerMessage','documentMessage']
                  .find(t => content[t]);

                if (mtype && mtype !== 'stickerMessage') {
                  try {
                    const { downloadMediaMessage } = require('@whiskeysockets/baileys');
                    const buf = await downloadMediaMessage(cached, 'buffer', {}, { reuploadRequest: sock.updateMediaMessage });
                    if (mtype === 'imageMessage') {
                      await sock.sendMessage(selfJid, { image: buf, caption: infoLine + (text ? '\n\n📝 ' + text : '') }, {});
                    } else if (mtype === 'videoMessage') {
                      await sock.sendMessage(selfJid, { video: buf, caption: infoLine + (text ? '\n\n📝 ' + text : '') }, {});
                    } else if (mtype === 'audioMessage') {
                      await sock.sendMessage(selfJid, { audio: buf, ptt: content.audioMessage?.ptt ?? true, mimetype: 'audio/ogg; codecs=opus' }, {});
                      await sock.sendMessage(selfJid, { text: infoLine }, {});
                    } else {
                      await sock.sendMessage(selfJid, { document: buf, mimetype: content[mtype]?.mimetype || 'application/octet-stream' }, {});
                      await sock.sendMessage(selfJid, { text: infoLine }, {});
                    }
                  } catch {
                    await sock.sendMessage(selfJid, { text: infoLine + '\n\n📎 _Média (non récupérable)_' }, {});
                  }
                } else if (mtype === 'stickerMessage') {
                  try {
                    const { downloadMediaMessage } = require('@whiskeysockets/baileys');
                    const buf = await downloadMediaMessage(cached, 'buffer', {});
                    await sock.sendMessage(selfJid, { sticker: buf }, {});
                    await sock.sendMessage(selfJid, { text: infoLine }, {});
                  } catch {
                    await sock.sendMessage(selfJid, { text: infoLine + '\n\n🎭 _Sticker supprimé_' }, {});
                  }
                } else {
                  if (text) await sock.sendMessage(selfJid, { text: infoLine + '\n\n💬 "' + text + '"' }, {});
                }
              } catch (err) {
                console.error('[anti-delete]', err.message);
              }
            })();
          }
          continue; // Ne pas traiter le protocolMessage comme une commande
        }
      }

      // ── Handler principal : exécution des commandes ──
      handler.handleMessage(sock, msg).catch(err => {
        if (!err.message?.includes('rate-overlimit')) console.error('Error handling message:', err.message);
      });

      setImmediate(async () => {
        if (config.autoRead && from.endsWith('@g.us')) {
          try { await sock.readMessages([msg.key]); } catch (e) {}
        }
        if (from.endsWith('@g.us')) {
          try {
            const groupMetadata = await handler.getGroupMetadata(sock, msg.key.remoteJid);
            if (groupMetadata) await handler.handleAntilink(sock, msg, groupMetadata);
          } catch (error) {}
        }
      });
    }
  });

  sock.ev.on('error', (error) => {
    const statusCode = error?.output?.statusCode;
    if (statusCode === 515 || statusCode === 503 || statusCode === 408) return;
    console.error('Socket error:', error.message || error);
  });

  return sock;
}

console.log('🚀 Starting WhatsApp MD Bot...\n');
console.log(`📦 Bot Name: ${config.botName}`);
cleanupPuppeteerCache();

startBot().catch(err => {
  console.error('Error starting bot:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  if (err.code === 'ENOSPC' || err.message?.includes('no space left')) {
    const { cleanupOldFiles } = require('./utils/cleanup');
    cleanupOldFiles();
    return;
  }
});
process.on('unhandledRejection', (err) => { console.error('❌ ERREUR CACHÉE :', err); });
module.exports = { store };
