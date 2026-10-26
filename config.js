/**
 * Global Configuration for DARK-MIKEY
 * Les valeurs sensibles viennent du fichier .env ou des variables d'environnement.
 */
require('./utils/env');

const saved = require('./utils/settingsStore').load(); // réglages changés via WhatsApp

const list = (v, fallback) => (v ? v.split(',').map(x => x.trim()).filter(Boolean) : fallback);

module.exports = {
    // Bot Owner Configuration
    ownerNumber: list(process.env.OWNER_NUMBER, ['']), // Défini via OWNER_NUMBER (indicatif inclus, sans + ni espaces)
    ownerName: list(process.env.OWNER_NAME, ['Mikey']), // Owner names corresponding to ownerNumber array
    
    // Bot Configuration
    botName: saved.botName || process.env.BOT_NAME || 'DARK-MIKEY',
    prefix: saved.prefix || process.env.PREFIX || '/',
    sessionName: 'session',
    sessionID: process.env.SESSION_ID || '',
    newsletterJid: saved.newsletterJid || process.env.NEWSLETTER_JID || '', // JID de ta chaîne WhatsApp (optionnel)
    updateZipUrl: process.env.UPDATE_ZIP_URL || '', // ZIP de TON dépôt (obligatoire pour .update)
    updateZipSha256: process.env.UPDATE_ZIP_SHA256 || '', // empreinte SHA-256 optionnelle
    
    // Sticker Configuration
    packname: process.env.BOT_NAME || 'DARK-MIKEY',
    
    // Bot Behavior
    selfMode: false, // Private mode - only owner can use commands
    autoRead: false,
    autoTyping: false,
    autoBio: false,
    autoSticker: false,
    autoReact: false,
    autoReactMode: 'bot',
    autoDownload: false,
    
    // Group Settings Defaults
    defaultGroupSettings: {
      antilink: false,
      antilinkAction: 'delete', // 'delete', 'kick', 'warn'
      antitag: false,
      antitagAction: 'delete',
      antiall: false, // Owner only - blocks all messages from non-admins
      antiviewonce: false,
      antibot: false,
      antibotAction: 'warn', // 'warn' | 'kick'
      anticall: false, // Anti-call feature
      antigroupmention: false, // Anti-group mention feature
      antigroupmentionAction: 'delete', // 'delete', 'kick'
      antigroupstatus: false, // Block group status posts
      antigroupstatusAction: 'delete', // 'delete', 'kick'
      antisticker: false, // Stickers not allowed in group
      antistickerAction: 'delete', // 'delete', 'kick'
      antibadword: false, // Block bad words in group
      antibadwordAction: 'delete', // 'delete', 'kick', 'warn'
      welcome: false,
      welcomeMessage: '╭╼━≪•𝙽𝙴𝚆 𝙼𝙴𝙼𝙱𝙴𝚁•≫━╾╮\n┃𝚆𝙴𝙻𝙲𝙾𝙼𝙴: @user 👋\n┃Member count: #memberCount\n┃𝚃𝙸𝙼𝙴: time⏰\n╰━━━━━━━━━━━━━━━╯\n\n*@user* Welcome to *@group*! 🎉\n*Group 𝙳𝙴𝚂𝙲𝚁𝙸𝙿𝚃𝙸𝙾𝙽*\ngroupDesc\n\n> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ botName*',
      goodbye: false,
      goodbyeMessage: 'Goodbye @user 👋 We will never miss you!',
      antiSpam: false,
      antidelete: false,
      nsfw: false,
      detect: false,
      chatbot: false,
      autosticker: false // Auto-convert images/videos to stickers
    },
    
    // API Keys (add your own)
    apiKeys: {
      openai: process.env.OPENAI_API_KEY || '',
      deepai: process.env.DEEPAI_API_KEY || '',
      remove_bg: process.env.REMOVE_BG_API_KEY || '',
      openweather: process.env.OPENWEATHER_API_KEY || '',
      princetech: process.env.PRINCETECH_API_KEY || ''
    },
    
    // Message Configuration
    messages: {
      wait: '⏳ Please wait...',
      success: '✅ Success!',
      error: '❌ Error occurred!',
      ownerOnly: '👑 This command is only for bot owner!',
      adminOnly: '🛡️ This command is only for group admins!',
      groupOnly: '👥 This command can only be used in groups!',
      privateOnly: '💬 This command can only be used in private chat!',
      botAdminNeeded: '🤖 Bot needs to be admin to execute this command!',
      invalidCommand: '❓ Invalid command! Type .menu for help'
    },
    
    // Timezone
    timezone: process.env.TIMEZONE || 'America/Port-au-Prince',

  // --- Telegram (cloud secondaire pour les vues uniques) ---
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    channelId: process.env.TELEGRAM_CHANNEL_ID || '',
  },
    
    // Limits
    maxWarnings: 3,
    
    // Social Links (optional)
    social: {
      github: process.env.GITHUB_URL || '',
      githubRepo: process.env.GITHUB_REPO || '', // ex: ton-compte/DARK-MIKEY
      youtube: process.env.YOUTUBE_URL || '',
      channel: process.env.CHANNEL_URL || ''
    }
};
  
