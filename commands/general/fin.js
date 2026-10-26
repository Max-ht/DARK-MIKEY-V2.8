const jeu = require('./jeu');
const sub = jeu.subCommands.find(s => s.name === 'fin');
module.exports = sub;
