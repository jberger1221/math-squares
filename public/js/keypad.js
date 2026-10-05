// The big buttons. Used for digits in the game and letters on the name screen.

import { sfx } from './audio.js';

const DIGITS = ['7', '8', '9', '4', '5', '6', '1', '2', '3'];

/**
 * A 3-wide number pad: 1-9, then 0 / backspace / OK.
 * Keyboard input is handled by the caller so it works whether or not a key is tapped.
 */
export function createKeypad({ onDigit, onBack, onSubmit }) {
  const pad = document.createElement('div');
  pad.className = 'keypad';

  const key = (label, cls, fn, aria) => {
    const b = document.createElement('button');
    b.textContent = label;
    if (cls) b.className = cls;
    if (aria) b.setAttribute('aria-label', aria);
    b.addEventListener('click', fn);
    return b;
  };

  for (const d of DIGITS) pad.append(key(d, '', () => onDigit(d)));
  pad.append(key('0', 'zero', () => onDigit('0')));
  pad.append(key('⌫', 'back', () => onBack(), 'delete'));

  const ok = key('✓', 'ok', () => onSubmit(), 'check answer');
  ok.style.gridColumn = 'span 3';
  ok.style.width = 'auto';
  pad.append(ok);

  return pad;
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const NUMBERS = '0123456789'.split('');

/**
 * A 7-wide letter grid for typing a name, for a kid who is still learning letters.
 * Names may contain digits, so they are on the pad by default -- but no crossword
 * answer ever has a 4 in it, and every extra key is one more thing to rule out.
 */
export function createLetterPad({ onLetter, onBack, onSubmit, digits = true }) {
  const pad = document.createElement('div');
  pad.className = 'letter-pad';

  for (const ch of digits ? [...LETTERS, ...NUMBERS] : LETTERS) {
    const b = document.createElement('button');
    b.textContent = ch;
    b.addEventListener('click', () => { sfx.navigate(); onLetter(ch); });
    pad.append(b);
  }

  const back = document.createElement('button');
  back.textContent = '⌫';
  back.className = 'back';
  back.style.borderColor = 'var(--red)';
  back.style.color = 'var(--red)';
  back.setAttribute('aria-label', 'delete');
  back.addEventListener('click', () => { sfx.back(); onBack(); });
  pad.append(back);

  const ok = document.createElement('button');
  ok.textContent = '✓';
  ok.className = 'ok';
  ok.style.borderColor = 'var(--green)';
  ok.style.color = 'var(--green)';
  ok.setAttribute('aria-label', 'start');
  ok.addEventListener('click', () => onSubmit());
  pad.append(ok);

  return pad;
}
