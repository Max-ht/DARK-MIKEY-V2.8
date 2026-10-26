# DARK-MIKEY

Bot WhatsApp multi-commandes (Node.js + Baileys), maintenu par Mikey.
Basé sur le projet open source Knight Bot Mini (MIT).

## Installation

```bash
git clone https://github.com/TON-COMPTE/DARK-MIKEY.git
cd DARK-MIKEY
cp .env.example .env     # puis remplis OWNER_NUMBER et le reste
npm install
npm start
```

Au premier lancement, scanne le QR code (ou renseigne `SESSION_ID`).
Le dossier `session/` contient les identifiants de ton compte : ne le publie jamais.

## Configuration (.env)

Voir `.env.example`. Les clés et réglages sensibles ne sont jamais écrits dans le code.

## Hébergement

Le bot doit tourner en continu et garder le dossier `session/` :
utilise un VPS, Railway, Render (payant, sinon mise en veille), Fly.io ou un panel Node.js.
Vercel n'est pas adapté (fonctions éphémères, pas de connexion permanente).

## Mise à jour

La commande `update` (owner) télécharge le ZIP défini par `UPDATE_ZIP_URL`
(HTTPS, hôtes GitHub uniquement, SHA-256 optionnel) et protège
`config.js`, `.env`, `session/`, `database/`.

## Licence

MIT, voir le fichier LICENSE (la mention du projet d'origine est conservée).
