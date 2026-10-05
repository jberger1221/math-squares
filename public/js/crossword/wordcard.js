// The card that pops out of a crossword square: one big picture, one row of letter
// slots, and the letter pad.
//
// Nothing here can end badly. The dots go out as guesses are spent, but the last dot
// does not cost the puzzle -- it spells the word out instead, and the player keeps
// going. Getting stuck is the one outcome a five-year-old will not sit through.

import { sfx } from '../audio.js';
import { createLetterPad } from '../keypad.js';

const OPEN_MS = 260;
const CLOSE_MS = 220;

export const MAX_TRIES = 4;
const FREE_LETTER_AT = 2;   // misses before one letter is given away

/**
 * @param known Map of position-in-word -> letter already standing on the grid,
 *              filled in by words that cross this one. Those slots are locked.
 */
export function openWordCard({
  cellEl, entry, known = new Map(), usedTries = 0,
  onCorrect, onWrong, onClose,
}) {
  const size = entry.word.length;
  const locked = new Set(known.keys());
  const letters = Array.from({ length: size }, (_, i) => known.get(i) || '');
  let attempts = usedTries;
  let settled = false;

  const backdrop = document.createElement('div');
  backdrop.className = 'backdrop';

  const card = document.createElement('div');
  card.className = 'card word-card';

  const picture = document.createElement('div');
  picture.className = 'word-picture';
  picture.textContent = entry.picture;
  picture.setAttribute('role', 'img');
  picture.setAttribute('aria-label', `spell this word: ${entry.word}`);

  const slots = document.createElement('div');
  slots.className = 'word-slots';
  const slotEls = [];
  for (let i = 0; i < size; i++) {
    const slot = document.createElement('span');
    slot.className = 'word-slot';
    slots.append(slot);
    slotEls.push(slot);
  }

  const tries = document.createElement('div');
  tries.className = 'tries';
  tries.setAttribute('aria-label', 'tries left');
  for (let i = 0; i < MAX_TRIES; i++) tries.append(document.createElement('i'));

  const hintBtn = document.createElement('button');
  hintBtn.className = 'hint-btn';
  hintBtn.textContent = '?';
  hintBtn.setAttribute('aria-label', 'give me a letter');
  hintBtn.addEventListener('click', () => { if (giveLetter()) sfx.hint(); });

  const meter = document.createElement('div');
  meter.className = 'card-meter';
  meter.append(tries, hintBtn);

  const pad = createLetterPad({ onLetter: type, onBack: back, onSubmit: submit, digits: false });

  card.append(picture, slots, meter, pad);
  backdrop.append(card);
  document.body.append(backdrop);
  paintTries();
  render();

  // ---- FLIP: grow out of the square that was tapped -------------------------
  const cardRect = card.getBoundingClientRect();
  const cellRect = cellEl.getBoundingClientRect();
  const shrunk = `translate(${(cellRect.left + cellRect.width / 2) - (cardRect.left + cardRect.width / 2)}px, ` +
    `${(cellRect.top + cellRect.height / 2) - (cardRect.top + cardRect.height / 2)}px) ` +
    `scale(${Math.max(0.06, cellRect.width / Math.max(cardRect.width, 1))})`;

  card.animate(
    [{ transform: shrunk, opacity: 0.15 }, { transform: 'none', opacity: 1 }],
    { duration: OPEN_MS, easing: 'cubic-bezier(.2, .9, .3, 1.25)' },
  );
  backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: OPEN_MS });
  sfx.open();

  // ---- input ----------------------------------------------------------------

  /** The next slot a typed letter should land in: the first one still empty. */
  function cursor() {
    for (let i = 0; i < size; i++) if (!letters[i]) return i;
    return -1;
  }

  function render() {
    const at = cursor();
    slotEls.forEach((slot, i) => {
      slot.textContent = letters[i] || '';
      slot.classList.toggle('locked', locked.has(i));
      slot.classList.toggle('here', i === at && !settled);
    });
  }

  function paintTries() {
    const left = Math.max(0, MAX_TRIES - attempts);
    [...tries.children].forEach((dot, i) => dot.classList.toggle('left', i < left));
    tries.classList.toggle('last-chance', left === 1);
  }

  function type(ch) {
    if (settled) return;
    const at = cursor();
    if (at === -1) return;
    letters[at] = ch;
    render();
    // Filling the last slot is almost always meant as an answer, and reaching for
    // the tick after every word gets old fast.
    if (cursor() === -1) setTimeout(submit, 220);
  }

  function back() {
    if (settled) return;
    for (let i = size - 1; i >= 0; i--) {
      if (letters[i] && !locked.has(i)) { letters[i] = ''; render(); return; }
    }
  }

  /** Hand over one correct letter and lock it. Returns false if there are none left. */
  function giveLetter() {
    const at = cursor();
    const i = at === -1 ? [...letters.keys()].find((k) => !locked.has(k)) : at;
    if (i === undefined || i === -1) return false;
    letters[i] = entry.word[i];
    locked.add(i);
    render();
    return true;
  }

  function submit() {
    if (settled || cursor() !== -1) return;

    if (letters.join('') === entry.word) {
      settled = true;
      card.classList.remove('wrong');
      card.classList.add('right');
      render();
      sfx.correct();
      setTimeout(() => finish(() => onCorrect?.(attempts === 0 && locked.size === known.size)), 460);
      return;
    }

    attempts += 1;
    paintTries();
    card.classList.remove('wrong');
    void card.offsetWidth;                  // restart the shake
    card.classList.add('wrong');
    sfx.wrong();
    // Keep what crossing words and hints established; only the guess is cleared.
    for (let i = 0; i < size; i++) if (!locked.has(i)) letters[i] = '';
    render();
    onWrong?.(attempts);

    // Two misses buys a letter. There is no version of this where he stares at an
    // empty row of boxes with nothing to try next.
    if (attempts === FREE_LETTER_AT) setTimeout(() => { if (giveLetter()) sfx.hint(); }, 450);

    if (attempts >= MAX_TRIES) {
      settled = true;
      setTimeout(() => {
        sfx.outOfTries();
        card.classList.remove('wrong');
        card.classList.add('reveal');
        for (let i = 0; i < size; i++) { letters[i] = entry.word[i]; locked.add(i); }
        render();
        // Spell it out, let him look at it, then take the word as answered. The
        // puzzle always moves forward.
        setTimeout(() => finish(() => onCorrect?.(false)), 1700);
      }, 500);
    }
  }

  function finish(after) {
    window.removeEventListener('keydown', onKey, true);
    const anim = card.animate(
      [{ transform: 'none', opacity: 1 }, { transform: shrunk, opacity: 0 }],
      { duration: CLOSE_MS, easing: 'cubic-bezier(.5, 0, .8, .3)' },
    );
    backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { duration: CLOSE_MS });
    anim.finished.catch(() => {}).then(() => { backdrop.remove(); after?.(); });
  }

  function cancel() {
    if (settled) return;
    settled = true;
    sfx.close();
    finish(() => onClose?.());
  }

  function onKey(e) {
    const ch = e.key.toUpperCase();
    if (/^[A-Z]$/.test(ch)) { sfx.navigate(); type(ch); e.preventDefault(); }
    else if (e.key === 'Backspace') { sfx.back(); back(); e.preventDefault(); }
    else if (e.key === 'Enter') { submit(); e.preventDefault(); }
    else if (e.key === 'Escape') { cancel(); e.preventDefault(); }
    e.stopPropagation();
  }

  window.addEventListener('keydown', onKey, true);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) cancel(); });

  return { close: cancel };
}
