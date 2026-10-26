/**
 * Update Command - Mise à jour via ZIP (Owner Only) - version sécurisée
 *
 * Garde-fous :
 *  - l'URL vient UNIQUEMENT de la config (UPDATE_ZIP_URL), jamais d'un message
 *  - HTTPS obligatoire, hôtes limités à GitHub
 *  - taille maximale du ZIP et délai maximal
 *  - vérification SHA-256 optionnelle (UPDATE_ZIP_SHA256)
 *  - extraction sans shell (execFile) + rejet des chemins dangereux (zip-slip)
 *  - dossiers/fichiers protégés : node_modules, session, tmp, temp, database, config.js, .env
 */

const { execFile } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const https = require('https');
const config = require('../../config');

const MAX_REDIRECTS = 5;
const MAX_ZIP_BYTES = 50 * 1024 * 1024; // 50 Mo
const TIMEOUT_MS = 60 * 1000;
const ALLOWED_HOSTS = ['github.com', 'codeload.github.com', 'raw.githubusercontent.com'];

const PROTECTED = [
  'node_modules', '.git', 'session', 'tmp', 'temp', 'database',
  'config.js', '.env', '.gitignore'
];

function run(file, args) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error((stderr || stdout || err.message || '').toString()));
      resolve((stdout || '').toString());
    });
  });
}

function validateUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new Error('URL de mise à jour invalide.'); }
  if (u.protocol !== 'https:') throw new Error('Seul HTTPS est autorisé pour la mise à jour.');
  if (!ALLOWED_HOSTS.includes(u.hostname)) {
    throw new Error(`Hôte non autorisé: ${u.hostname}. Autorisés: ${ALLOWED_HOSTS.join(', ')}`);
  }
  return u.toString();
}

function downloadFile(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > MAX_REDIRECTS) return reject(new Error('Trop de redirections.'));
    let safeUrl;
    try { safeUrl = validateUrl(url); } catch (e) { return reject(e); }

    const req = https.get(safeUrl, {
      headers: { 'User-Agent': 'DARK-MIKEY-Updater/1.0', 'Accept': '*/*' },
      timeout: TIMEOUT_MS
    }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        const location = res.headers.location;
        res.resume();
        if (!location) return reject(new Error(`HTTP ${res.statusCode} sans Location`));
        return downloadFile(new URL(location, safeUrl).toString(), dest, redirects + 1).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      const hash = crypto.createHash('sha256');
      let size = 0;
      const file = fs.createWriteStream(dest);
      res.on('data', chunk => {
        size += chunk.length;
        hash.update(chunk);
        if (size > MAX_ZIP_BYTES) {
          req.destroy(new Error('ZIP trop volumineux.'));
        }
      });
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(hash.digest('hex'))));
      file.on('error', err => fs.unlink(dest, () => reject(err)));
    });
    req.on('timeout', () => req.destroy(new Error('Délai dépassé pendant le téléchargement.')));
    req.on('error', err => fs.unlink(dest, () => reject(err)));
  });
}

async function firstThatWorks(attempts) {
  let lastErr;
  for (const [file, args] of attempts) {
    try { return await run(file, args); } catch (e) { lastErr = e; }
  }
  throw new Error(`Aucun outil d'extraction disponible (unzip / tar / 7z). Dernière erreur: ${lastErr ? lastErr.message : 'inconnue'}`);
}

async function listZipEntries(zipPath) {
  // On liste d'abord le contenu (sans shell) pour détecter les chemins dangereux
  const out = await firstThatWorks([
    ['unzip', ['-Z1', zipPath]],
    ['tar', ['-tf', zipPath]],
    ['7z', ['l', '-ba', '-slt', zipPath]]
  ]);
  return out.split(/\r?\n/).map(l => l.replace(/^Path = /, '')).filter(Boolean);
}

function assertSafeEntries(entries) {
  for (const e of entries) {
    const norm = path.posix.normalize(e.replace(/\\/g, '/'));
    if (norm.startsWith('/') || norm.startsWith('..') || norm.includes('/../') || /^[a-zA-Z]:/.test(norm)) {
      throw new Error(`Entrée dangereuse dans le ZIP: ${e}`);
    }
  }
}

async function extractZip(zipPath, outDir) {
  const entries = await listZipEntries(zipPath);
  assertSafeEntries(entries);
  fs.mkdirSync(outDir, { recursive: true });
  await firstThatWorks([
    ['unzip', ['-o', zipPath, '-d', outDir]],
    ['tar', ['-xf', zipPath, '-C', outDir]],
    ['7z', ['x', '-y', zipPath, `-o${outDir}`]]
  ]);
}

function copyRecursive(src, dest, ignore, relative = '', outList = []) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    if (ignore.includes(entry)) continue;
    const s = path.join(src, entry);
    const d = path.join(dest, entry);
    const stat = fs.lstatSync(s);
    if (stat.isSymbolicLink()) continue; // on ignore les liens symboliques
    if (stat.isDirectory()) {
      copyRecursive(s, d, ignore, path.join(relative, entry), outList);
    } else {
      fs.copyFileSync(s, d);
      outList.push(path.join(relative, entry).replace(/\\/g, '/'));
    }
  }
  return outList;
}

async function updateViaZip(zipUrl, expectedSha256) {
  const tmpDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const zipPath = path.join(tmpDir, 'update.zip');
  const extractTo = path.join(tmpDir, 'update_extract');

  try {
    const sha = await downloadFile(zipUrl, zipPath);

    if (expectedSha256 && sha.toLowerCase() !== expectedSha256.toLowerCase()) {
      throw new Error('Empreinte SHA-256 différente de celle attendue. Mise à jour annulée.');
    }

    if (fs.existsSync(extractTo)) fs.rmSync(extractTo, { recursive: true, force: true });
    await extractZip(zipPath, extractTo);

    const entries = fs.readdirSync(extractTo);
    const rootCandidate = entries.length === 1 ? path.join(extractTo, entries[0]) : extractTo;
    const srcRoot = fs.existsSync(rootCandidate) && fs.lstatSync(rootCandidate).isDirectory() ? rootCandidate : extractTo;

    const copied = copyRecursive(srcRoot, process.cwd(), PROTECTED);
    return { copiedFiles: copied, sha256: sha };
  } finally {
    try { fs.rmSync(extractTo, { recursive: true, force: true }); } catch {}
    try { fs.rmSync(zipPath, { force: true }); } catch {}
  }
}

module.exports = {
  name: 'update',
  aliases: ['upgrade'],
  category: 'owner',
  description: 'Met à jour le bot depuis le ZIP configuré (Owner Only)',
  usage: 'update',
  ownerOnly: true,

  async execute(sock, msg, args, extra) {
    const chatId = msg.key.remoteJid;
    const zipUrl = (config.updateZipUrl || process.env.UPDATE_ZIP_URL || '').trim();

    if (!zipUrl) {
      return extra.reply('❌ Aucune URL de mise à jour configurée. Renseigne UPDATE_ZIP_URL dans ton .env (ZIP de ton propre dépôt GitHub).');
    }

    try {
      await extra.reply('🔄 Mise à jour en cours, patiente…');

      const { copiedFiles, sha256 } = await updateViaZip(zipUrl, config.updateZipSha256);

      const summary = copiedFiles.length
        ? `✅ Mise à jour terminée. Fichiers mis à jour : ${copiedFiles.length}`
        : '✅ Mise à jour terminée. Aucun fichier à modifier.';

      await sock.sendMessage(chatId, { text: `${summary}\nSHA-256: ${sha256.slice(0, 12)}…\nRedémarrage…` }, { quoted: msg });

      try {
        await run('pm2', ['restart', 'all']);
        return;
      } catch {}

      setTimeout(() => process.exit(0), 500);
    } catch (error) {
      console.error('Update failed:', error);
      await sock.sendMessage(chatId, { text: `❌ Échec de la mise à jour :\n${String(error.message || error)}` }, { quoted: msg });
    }
  }
};

// Exposé pour les tests uniquement
module.exports._test = { validateUrl, assertSafeEntries, copyRecursive, extractZip, PROTECTED };
