// Where players are saved. Every call fails soft: a dead server must never freeze the
// game mid-answer.
//
// At home the game runs off server.js and saves through its JSON API. Published as a
// claude.ai artifact there is no server, so it saves instead to the artifact's own
// database -- into the viewer's private corner of it, so families never see each
// other's players -- or, for a viewer the database will not let write (anyone from
// outside the owner's organization), to this browser's own storage.

const IN_ARTIFACT = typeof window !== 'undefined' && 'claude' in window;

/** Same rule as the server: capitals and digits, at most 8. */
const cleanName = (input) => String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

function blankPlayer(name) {
  const now = new Date().toISOString();
  return {
    name, created: now, lastPlayed: now,
    bestStreak: 0, totalCorrect: 0, totalWrong: 0, totalScore: 0, levels: {},
  };
}

/** The two leaderboards, built the way the server builds them. */
function scoreboard(players) {
  const top = (key) => players
    .filter((p) => p[key] > 0)
    .sort((a, b) => b[key] - a[key])
    .slice(0, 10)
    .map((p) => ({ name: p.name, value: p[key] }));
  return { byScore: top('totalScore'), byStreak: top('bestStreak') };
}

// ---------------------------------------------------------------- at home: the server

async function request(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

const server = {
  getPlayer: (name) => request(`/api/player/${encodeURIComponent(name)}`),
  putPlayer: (profile) => request(`/api/player/${encodeURIComponent(profile.name)}`, {
    method: 'PUT',
    body: JSON.stringify(profile),
  }),
  listPlayers: async () => (await request('/api/players')).players,
  highscores: () => request('/api/highscores'),
  version: async () => (await request('/api/version')).build,
};

// ---------------------------------------------------------------- as an artifact

/** This browser's own shelf. Can be cleared with the browser's data, so it is the fallback. */
function browserShelf() {
  const KEY = 'ms-players';
  const read = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
  };
  return {
    async get(name) { return read()[name] || null; },
    async all() { return Object.values(read()); },
    async put(profile) {
      const players = read();
      players[profile.name] = profile;
      try { localStorage.setItem(KEY, JSON.stringify(players)); } catch { /* full or blocked: play on */ }
    },
  };
}

/** The viewer's private corner of the artifact's database: one document per player. */
function databaseShelf(db, uid, fallback) {
  const players = db.collection(`data/users/${uid}`);
  let refused = false;            // this viewer cannot write here; use the browser instead
  const writing = new Map();      // name -> the write in flight, so writes to one player queue

  return {
    async get(name) {
      if (refused) return fallback.get(name);
      const snap = await players.doc(name).get();
      return snap.exists ? structuredClone(snap.data()) : fallback.get(name);
    },
    async all() {
      if (refused) return fallback.all();
      const snap = await players.get();
      const saved = snap.docs.map((d) => structuredClone(d.data()));
      // Anyone played here before the database was reachable still counts.
      const names = new Set(saved.map((p) => p.name));
      return [...saved, ...(await fallback.all()).filter((p) => !names.has(p.name))];
    },
    put(profile) {
      const body = structuredClone(profile);
      const previous = writing.get(profile.name) || Promise.resolve();
      const next = previous.then(async () => {
        if (refused) return fallback.put(body);
        try {
          await players.doc(profile.name).set(body);
        } catch (err) {
          // View-only viewers have an id but may not write; say goodbye to the
          // database for this visit and keep their progress in the browser.
          if (err?.code === 'invalid_argument' || err?.code === 'not_granted') refused = true;
          await fallback.put(body);
        }
      });
      writing.set(profile.name, next.catch(() => {}));
      return next;
    },
  };
}

let shelfPromise = null;

function shelf() {
  shelfPromise ||= (async () => {
    const fallback = browserShelf();
    try {
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      const uid = await user?.id();
      return db && uid ? databaseShelf(db, uid, fallback) : fallback;
    } catch {
      return fallback;
    }
  })();
  return shelfPromise;
}

const artifact = {
  async getPlayer(name) {
    const clean = cleanName(name);
    const s = await shelf();
    const found = await s.get(clean);
    if (found) return found;
    // Creating on read, like the server: ask for a profile, get one.
    const fresh = blankPlayer(clean);
    await s.put(fresh);
    return fresh;
  },
  async putPlayer(profile) {
    const saved = { ...profile, name: cleanName(profile.name), lastPlayed: new Date().toISOString() };
    await (await shelf()).put(saved);
    return saved;
  },
  async listPlayers() {
    const all = await (await shelf()).all();
    return all
      .sort((a, b) => (b.lastPlayed || '').localeCompare(a.lastPlayed || ''))
      .map((p) => ({ name: p.name, totalScore: p.totalScore, bestStreak: p.bestStreak }));
  },
  async highscores() {
    return scoreboard(await (await shelf()).all());
  },
  version: async () => null,
};

const backend = IN_ARTIFACT ? artifact : server;

// ---------------------------------------------------------------- the calls the game makes

export const getPlayer = (name) => backend.getPlayer(name);
export const putPlayer = (profile) => backend.putPlayer(profile);

export async function listPlayers() {
  try { return await backend.listPlayers(); }
  catch { return []; }
}

export async function highscores() {
  try { return await backend.highscores(); }
  catch { return { byScore: [], byStreak: [] }; }
}

/** The build stamp for the title screen, or null where there is none to show. */
export async function buildVersion() {
  try { return await backend.version(); }
  catch { return undefined; }   // a server that should be there and is not
}
