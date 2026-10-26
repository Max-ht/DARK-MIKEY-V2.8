const jeu = require('./jeu');
const sub = jeu.subCommands.find(s => s.name === 'rejoindre');
module.exports = sub;
