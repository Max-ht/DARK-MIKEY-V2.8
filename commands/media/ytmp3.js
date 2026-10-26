/**
 * /ytmp3 - Télécharger l'audio d'une vidéo YouTube
 */
const ytModule = require('./youtube');
module.exports = {
  name: 'ytmp3',
  aliases: ['ytaudio', 'ytmusique', 'ytmusic'],
  category: 'media',
  description: 'Télécharger l\'audio d\'une vidéo YouTube (MP3)',
  usage: '/ytmp3 <URL ou titre>',
  execute: (sock, msg, args, extra) => ytModule.subCommands[0].execute(sock, msg, args, extra),
};
