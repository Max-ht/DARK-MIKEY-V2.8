const jeu = require('./jeu');
const sub = jeu.subCommands.find(s => s.name === 'prochain');
module.exports = sub;
