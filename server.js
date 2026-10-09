#!/usr/bin/env node
// MATH SQUARES -- static file server + a very small JSON API.
// Zero dependencies on purpose: this should still boot in five years.

import { createServer } from 'node:http';
import { readFile, writeFile, rename, mkdir, readdir, stat } from 'node:fs/promises';
import { join, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC = join(ROOT, 'public');
const DATA_DIR = join(ROOT, 'data');
const SCORES = join(DATA_DIR, 'scores.json');
const PORT = Number(process.env.PORT) || 8099;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'audio/mp4',   // the letters game's voice; Safari won't play it as a bare download
};

// ---------------------------------------------------------------- storage

let db = { players: {} };
let saveTimer = null;

async function load() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await readFile(SCORES, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.players) db = parsed;
  } catch (err) {
    if (err.code !== 'ENOENT') {
      // A corrupt file should not cost the kid his progress silently.
      console.warn(`[scores] could not read ${SCORES}: ${err.message}`);
      console.warn('[scores] starting empty; the old file will be overwritten on next save.');
    }
  }
}

// Debounced so a fast streak of answers is one disk write, not twenty.
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => { saveTimer = null; flush(); }, 300);
}

async function flush() {
  const tmp = `${SCORES}.${process.pid}.tmp`;
  try {
    await writeFile(tmp, JSON.stringify(db, null, 2));
    await rename(tmp, SCORES); // atomic: never a half-written scores.json
  } catch (err) {
    console.error(`[scores] save failed: ${err.message}`);
  }
}

function cleanName(input) {
  return String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

function blankPlayer(name) {
  return {
    name,
    created: new Date().toISOString(),
    lastPlayed: new Date().toISOString(),
    bestStreak: 0,
    totalCorrect: 0,
    totalWrong: 0,
    totalScore: 0,
    levels: {},
  };
}

// ---------------------------------------------------------------- helpers

function sendJSON(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

function readBody(req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}

function scoreboard() {
  const all = Object.values(db.players);
  const top = (key) => all
    .filter((p) => p[key] > 0)
    .sort((a, b) => b[key] - a[key])
    .slice(0, 10)
    .map((p) => ({ name: p.name, value: p[key] }));
  return { byScore: top('totalScore'), byStreak: top('bestStreak') };
}

// ---------------------------------------------------------------- api

async function handleApi(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean); // ['api', ...]

  if (parts[1] === 'players' && req.method === 'GET') {
    const players = Object.values(db.players)
      .sort((a, b) => (b.lastPlayed || '').localeCompare(a.lastPlayed || ''))
      .map((p) => ({ name: p.name, totalScore: p.totalScore, bestStreak: p.bestStreak }));
    return sendJSON(res, 200, { players });
  }

  if (parts[1] === 'highscores' && req.method === 'GET') {
    return sendJSON(res, 200, scoreboard());
  }

  if (parts[1] === 'version' && req.method === 'GET') {
    return sendJSON(res, 200, { build: await buildStamp() });
  }

  if (parts[1] === 'player' && parts[2]) {
    const name = cleanName(decodeURIComponent(parts[2]));
    if (!name) return sendJSON(res, 400, { error: 'bad name' });

    if (req.method === 'GET') {
      // Creating on read keeps the client simple: ask for a profile, get one.
      if (!db.players[name]) { db.players[name] = blankPlayer(name); scheduleSave(); }
      return sendJSON(res, 200, db.players[name]);
    }

    if (req.method === 'PUT') {
      let incoming;
      try { incoming = await readBody(req); }
      catch { return sendJSON(res, 400, { error: 'bad json' }); }

      const existing = db.players[name] || blankPlayer(name);
      const saved = {
        ...existing,
        ...incoming,
        name,                                  // the key is the truth, not the body
        created: existing.created,
        lastPlayed: new Date().toISOString(),
        levels: incoming.levels || existing.levels || {},
      };
      db.players[name] = saved;
      scheduleSave();
      return sendJSON(res, 200, saved);
    }
  }

  return sendJSON(res, 404, { error: 'no such route' });
}

/**
 * The newest edit time under public/, as MMDD-HHMM. Shown on the title screen so a
 * stale tab is obvious at a glance -- ES modules stay in the page's module map until
 * you actually reload, so "I changed the file" and "the browser is running it" are
 * two different claims.
 */
async function buildStamp() {
  let newest = 0;
  const walk = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else newest = Math.max(newest, (await stat(full)).mtimeMs);
    }
  };
  try { await walk(PUBLIC); } catch { return '?'; }
  const d = new Date(newest);
  const p2 = (n) => String(n).padStart(2, '0');
  return `${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}`;
}

// ---------------------------------------------------------------- static

async function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/' || rel.endsWith('/')) rel += 'index.html';

  // normalize() collapses ../ before we join, so nothing escapes public/.
  const target = join(PUBLIC, normalize(rel));
  if (target !== PUBLIC && !target.startsWith(PUBLIC + sep)) {
    res.writeHead(403).end('forbidden');
    return;
  }

  try {
    const body = await readFile(target);
    res.writeHead(200, {
      'Content-Type': MIME[extname(target).toLowerCase()] || 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': 'no-store', // local dev: always show the newest edit
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('not found');
  }
}

// ---------------------------------------------------------------- boot

function lanAddress() {
  for (const list of Object.values(networkInterfaces())) {
    for (const iface of list || []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return null;
}

await load();

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
    else await serveStatic(req, res, url);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.writeHead(500).end('server error');
  }
});

function announce(port) {
  const lan = lanAddress();
  console.log('');
  console.log('  ░▒▓  M A T H   S Q U A R E S  ▓▒░');
  console.log('');
  console.log(`  On this Mac : http://localhost:${port}`);
  if (lan) console.log(`  On the iPad : http://${lan}:${port}`);
  console.log('');
  console.log('  Ctrl-C to stop.');
  console.log('');
}

// If something else already owns the port, walk up rather than crashing with a
// stack trace -- this gets started by someone who just wants to play a game.
let attempt = 0;
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && attempt < 20) {
    attempt += 1;
    server.listen(PORT + attempt, '0.0.0.0');
    return;
  }
  console.error(`\n  Could not start the server: ${err.message}\n`);
  process.exit(1);
});
server.on('listening', () => announce(server.address().port));

server.listen(PORT, '0.0.0.0');

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    if (saveTimer) clearTimeout(saveTimer);
    await flush(); // never lose the last answer on shutdown
    process.exit(0);
  });
}
