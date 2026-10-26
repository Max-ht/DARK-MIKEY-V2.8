/**
 * Instagram to Sticker (cropped square)
 * igsc - Même logique que igs, mais recadre l'image en carré.
 * Toute la logique vit dans igs.js (plus de code dupliqué).
 */

const igs = require('./igs');

module.exports = {
  name: 'igsc',
  aliases: ['igstickercrop'],
  description: 'Convert Instagram post/reel to cropped square sticker',
  usage: '.igsc <Instagram URL>',
  category: 'media',

  async execute(sock, msg, args, extra) {
    await igs.run(sock, msg, args, extra, true);
  }
};
