// Who is playing. Returning players tap their name; new ones spell it out.

import { go } from '../router.js';
import { sfx } from '../audio.js';
import { createLetterPad } from '../keypad.js';
import { listPlayers } from '../api.js';
import { loadProfile, lastPlayerName } from '../state.js';

const MAX = 8;
let keyHandler = null;

export async function mount(el) {
  let name = '';

  const heading = document.createElement('h2');
  heading.className = 'title-md neon';
  heading.textContent = 'WHO IS PLAYING?';

  const known = document.createElement('div');
  known.className = 'known-players';

  const display = document.createElement('div');
  display.className = 'name-display';

  const pad = createLetterPad({ onLetter: add, onBack: back, onSubmit: submit });

  el.append(heading, known, display, pad);
  render();
  listenForKeys();          // before the await, so a fast typist is never dropped

  // Familiar names first, so after the first visit he never spells anything again.
  const players = await listPlayers();
  const last = lastPlayerName();
  players.sort((a, b) => (b.name === last) - (a.name === last));
  for (const p of players.slice(0, 8)) {
    const b = document.createElement('button');
    b.textContent = p.name;
    b.addEventListener('click', () => { name = p.name; render(); submit(); });
    known.append(b);
  }

  function render() {
    display.innerHTML = `${name}<span class="name-caret">_</span>`;
  }

  function add(ch) {
    if (name.length >= MAX) return;
    name += ch;
    render();
  }

  function back() {
    name = name.slice(0, -1);
    render();
  }

  async function submit() {
    if (!name) return;
    sfx.start();
    try {
      await loadProfile(name);
      go('gamepick');
    } catch (err) {
      heading.textContent = 'SERVER IS ASLEEP';
      heading.className = 'title-md neon-pink';
      console.error(err);
    }
  }

  function listenForKeys() {
    keyHandler = (e) => {
      const ch = e.key.toUpperCase();
      if (/^[A-Z0-9]$/.test(ch)) { sfx.navigate(); add(ch); }
      else if (e.key === 'Backspace') { sfx.back(); back(); }
      else if (e.key === 'Enter') submit();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', keyHandler);
  }
}

export function unmount() {
  if (keyHandler) { window.removeEventListener('keydown', keyHandler); keyHandler = null; }
}
