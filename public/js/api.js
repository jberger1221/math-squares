// Thin wrappers over the server's JSON API.
// Every call fails soft: a dead server must never freeze the game mid-answer.

async function request(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

export function getPlayer(name) {
  return request(`/api/player/${encodeURIComponent(name)}`);
}

export function putPlayer(profile) {
  return request(`/api/player/${encodeURIComponent(profile.name)}`, {
    method: 'PUT',
    body: JSON.stringify(profile),
  });
}

export async function listPlayers() {
  try { return (await request('/api/players')).players; }
  catch { return []; }
}

export async function highscores() {
  try { return await request('/api/highscores'); }
  catch { return { byScore: [], byStreak: [] }; }
}
