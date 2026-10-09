// Attract mode: neon logo, a grid solving itself in the background, PRESS START.

import { go } from '../router.js';
import { unlock, sfx } from '../audio.js';
import { createGrid } from '../grid.js';
import { answerFor, DEFAULT_OP } from '../levels.js';
import { buildVersion } from '../api.js';

const DEMO_SIZE = 4;
let timer = null;
let armed = false;
let detach = null;

function startDemo(host) {
  const grid = createGrid({ level: DEMO_SIZE, op: DEFAULT_OP });
  host.append(grid.el);

  const order = [];
  for (let r = 0; r < DEMO_SIZE; r++) for (let c = 0; c < DEMO_SIZE; c++) order.push([r, c]);

  let i = 0;
  timer = setInterval(() => {
    if (i >= order.length) {
      grid.reset();   // ...and run it again, forever, like a cabinet nobody is playing
      i = 0;
      return;
    }
    const [r, c] = order[i++];
    grid.setSolved(r, c, answerFor(DEFAULT_OP, DEMO_SIZE, r, c), true, true);
  }, 420);
}

export function mount(el) {
  const demo = document.createElement('div');
  demo.id = 'demo-grid';
  el.append(demo);
  startDemo(demo);

  const stack = document.createElement('div');
  stack.className = 'title-stack';
  stack.innerHTML = `
    <h1 class="title-lg neon">MATH</h1>
    <h1 class="title-lg neon-pink">SQUARES</h1>
    <p class="press-start neon-yellow blink">&#9654; PRESS START</p>
  `;
  el.append(stack);

  const hint = document.createElement('p');
  hint.className = 'corner-hint';
  hint.textContent = 'TAP ANYWHERE';
  el.append(hint);

  // Stamp the build in the corner. If this does not match what the server reports,
  // the tab is stale and needs a reload.
  const stamp = document.createElement('p');
  stamp.className = 'build-stamp';
  el.append(stamp);
  // Published as an artifact there is no server and nothing to stamp.
  buildVersion().then((build) => {
    if (build) stamp.textContent = `BUILD ${build}`;
    else if (build === undefined) stamp.textContent = 'OFFLINE';
  });

  // Any tap or key starts the game -- and, crucially, is the gesture that lets
  // the browser turn the sound on.
  armed = true;
  const begin = () => {
    if (!armed) return;
    armed = false;
    unlock();
    sfx.start();
    go('nameentry');
  };

  el.addEventListener('click', begin);
  window.addEventListener('keydown', begin);
  detach = () => {
    el.removeEventListener('click', begin);
    window.removeEventListener('keydown', begin);
  };
}

export function unmount() {
  armed = false;
  if (timer) { clearInterval(timer); timer = null; }
  detach?.();
  detach = null;
}
