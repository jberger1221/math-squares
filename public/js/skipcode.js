// The grown-up's key: when saved progress goes missing, a code reopens locked levels.
// It hides behind a number a five-year-old won't guess, not behind words -- he can't
// read the prompt, but he could easily tap a button that just said "unlock".

import { sfx } from './audio.js';
import { createKeypad } from './keypad.js';
import { createDancer, MAX_STAGE } from './dancer.js';

const CODE = '6578';

/**
 * A 🔑 chip for a puzzle picker. Tapping it asks for the code; the right code calls
 * `onUnlocked`, and the picker then lets locked tiles be tapped.
 */
export function createSkipKey({ onUnlocked }) {
  const key = document.createElement('button');
  key.className = 'chip skip-key';
  key.textContent = '🔑';
  key.setAttribute('aria-label', 'unlock a level with the code');
  key.addEventListener('click', () => { sfx.open(); askForCode(onUnlocked); });
  return key;
}

function askForCode(onUnlocked) {
  let typed = '';

  const backdrop = document.createElement('div');
  backdrop.className = 'backdrop';

  const card = document.createElement('div');
  card.className = 'card code-card';

  const slots = document.createElement('div');
  slots.className = 'code-slots';
  const boxes = [...CODE].map(() => {
    const b = document.createElement('span');
    b.className = 'code-box';
    slots.append(b);
    return b;
  });

  const paint = () => boxes.forEach((b, i) => {
    b.textContent = i < typed.length ? '●' : '';
    b.classList.toggle('filled', i < typed.length);
  });

  const close = () => {
    window.removeEventListener('keydown', onKey);
    backdrop.remove();
  };

  const submit = () => {
    if (typed === CODE) {
      card.classList.add('right');
      sfx.unlockChime();
      setTimeout(() => { close(); onUnlocked(); }, 350);
      return;
    }
    sfx.wrong();
    card.classList.remove('wrong');
    void card.offsetWidth;            // restart the shake if it is already shaking
    card.classList.add('wrong');
    typed = '';
    paint();
  };

  const digit = (d) => {
    if (typed.length >= CODE.length) return;
    sfx.digit(Number(d));
    typed += d;
    paint();
    if (typed.length === CODE.length) setTimeout(submit, 150);
  };
  const back = () => { typed = typed.slice(0, -1); paint(); };

  const onKey = (e) => {
    if (/^[0-9]$/.test(e.key)) digit(e.key);
    else if (e.key === 'Backspace') back();
    else if (e.key === 'Enter') submit();
    else if (e.key === 'Escape') { sfx.close(); close(); }
    else return;
    e.preventDefault();
  };
  window.addEventListener('keydown', onKey);

  const lock = document.createElement('div');
  lock.className = 'code-lock';
  lock.textContent = '🔒';

  slots.prepend(lock);
  card.append(slots, createKeypad({ onDigit: digit, onBack: back, onSubmit: submit }));
  card.addEventListener('click', (e) => e.stopPropagation());
  backdrop.addEventListener('click', () => { sfx.close(); close(); });
  backdrop.append(card);
  document.body.append(backdrop);
  paint();
}

/**
 * After the code on PICK A GAME: every form of the dancer, to put a lost evolution
 * back. Tapping one calls `onPick(stage)`.
 */
export function chooseStage({ current, onPick }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'backdrop';

  const card = document.createElement('div');
  card.className = 'card stage-card';

  const grid = document.createElement('div');
  grid.className = 'stage-grid';

  for (let stage = 0; stage <= MAX_STAGE; stage++) {
    const tile = document.createElement('button');
    tile.className = 'stage-tile';
    if (stage === current) tile.classList.add('current');
    tile.setAttribute('aria-label', `dancer stage ${stage}`);

    const canvas = document.createElement('canvas');
    canvas.className = 'dancer';
    createDancer(canvas, { stage });   // stops drawing by itself once the panel is gone

    const n = document.createElement('span');
    n.textContent = String(stage);

    tile.append(canvas, n);
    tile.addEventListener('click', () => {
      sfx.unlockChime();
      backdrop.remove();
      onPick(stage);
    });
    grid.append(tile);
  }

  card.append(grid);
  card.addEventListener('click', (e) => e.stopPropagation());
  backdrop.addEventListener('click', () => { sfx.close(); backdrop.remove(); });
  backdrop.append(card);
  document.body.append(backdrop);
  grid.querySelector('.current')?.focus();
}
