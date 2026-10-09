// The grown-up's key: when saved progress goes missing, a code reopens locked levels.
// It hides behind a number a five-year-old won't guess, not behind words -- he can't
// read the prompt, but he could easily tap a button that just said "unlock".

import { sfx } from './audio.js';
import { createKeypad } from './keypad.js';

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
