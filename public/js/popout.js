// The equation card that pops out of a cell.
//
// It flies out of the exact square you tapped and flies back into it when you are
// right -- a five-year-old should never have to wonder which box he just answered.

import { sfx } from './audio.js';
import { createKeypad } from './keypad.js';
import { createHint } from './hint.js';

const OPEN_MS = 260;
const CLOSE_MS = 220;

export function openPopout({
  cellEl, a, b, op, symbol, expected, maxLen = 2,
  maxTries = 5, usedTries = 0, hintOpen = false,
  onCorrect, onWrong, onOutOfTries, onHint, onClose,
}) {
  let value = '';
  // Tries carry over if the card is closed and reopened -- otherwise tapping outside
  // would be a free reset, and the five tries would mean nothing.
  let attempts = usedTries;
  let settled = false;

  const backdrop = document.createElement('div');
  backdrop.className = 'backdrop';

  const card = document.createElement('div');
  card.className = 'card';

  const eq = document.createElement('div');
  eq.className = 'equation';
  eq.innerHTML =
    `<span class="a">${a}</span><span class="op">${symbol}</span>` +
    `<span class="b">${b}</span><span class="eq">=</span>`;

  const slot = document.createElement('span');
  slot.className = 'answer-slot';
  eq.append(slot);

  // Five dots that go out one at a time. No words -- he can just count them.
  const tries = document.createElement('div');
  tries.className = 'tries';
  tries.setAttribute('aria-label', 'tries left');
  for (let i = 0; i < maxTries; i++) tries.append(document.createElement('i'));
  paintTries();

  const hintBtn = document.createElement('button');
  hintBtn.className = 'hint-btn';
  hintBtn.textContent = '?';
  hintBtn.setAttribute('aria-label', 'show a picture');
  hintBtn.addEventListener('click', toggleHint);

  const meter = document.createElement('div');
  meter.className = 'card-meter';
  meter.append(tries, hintBtn);

  // The picture is built once and then just shown or hidden, so toggling is instant.
  const hint = createHint({ op, a, b });

  const pad = createKeypad({ onDigit: digit, onBack: back, onSubmit: submit });

  card.append(eq, meter, hint, pad);
  if (hintOpen) showHint(false);
  backdrop.append(card);
  document.body.append(backdrop);
  render();

  // ---- FLIP: start the card sitting on top of the cell, then grow to place ----
  const cardRect = card.getBoundingClientRect();
  const cellRect = cellEl.getBoundingClientRect();
  const flip = {
    dx: (cellRect.left + cellRect.width / 2) - (cardRect.left + cardRect.width / 2),
    dy: (cellRect.top + cellRect.height / 2) - (cardRect.top + cardRect.height / 2),
    scale: Math.max(0.06, cellRect.width / Math.max(cardRect.width, 1)),
  };
  const shrunk = `translate(${flip.dx}px, ${flip.dy}px) scale(${flip.scale})`;

  card.animate(
    [{ transform: shrunk, opacity: 0.15 }, { transform: 'none', opacity: 1 }],
    { duration: OPEN_MS, easing: 'cubic-bezier(.2, .9, .3, 1.25)' },
  );
  backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: OPEN_MS });
  sfx.open();

  // ---- input ----------------------------------------------------------------

  function render() {
    slot.innerHTML = value
      ? `${value}<span class="caret">_</span>`
      : `<span class="caret">_</span>`;
  }

  function showHint(announce = true) {
    if (card.classList.contains('hinting')) return;
    card.classList.add('hinting');
    hintBtn.classList.add('on');
    if (announce) { sfx.hint(); onHint?.(); }
    // The card just grew; make sure it is still fully on screen.
    requestAnimationFrame(() => card.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }

  function toggleHint() {
    if (card.classList.contains('hinting')) {
      card.classList.remove('hinting');
      hintBtn.classList.remove('on');
      sfx.close();
      onHint?.(false);
      return;
    }
    showHint();
  }

  function paintTries() {
    const left = Math.max(0, maxTries - attempts);
    [...tries.children].forEach((dot, i) => dot.classList.toggle('left', i < left));
    tries.classList.toggle('last-chance', left === 1);
  }

  function digit(d) {
    if (settled || value.length >= maxLen) return;
    if (value === '0') value = '';          // no leading zeros to puzzle over
    value += d;
    sfx.digit(Number(d));
    render();
  }

  function back() {
    if (settled || !value) return;
    value = value.slice(0, -1);
    sfx.back();
    render();
  }

  function submit() {
    if (settled || !value) return;

    if (Number(value) === expected) {
      settled = true;
      card.classList.remove('wrong');
      card.classList.add('right');
      sfx.correct();
      // Let the win land for a beat before the card flies home.
      setTimeout(() => finish(() => onCorrect?.(attempts === 0)), 420);
      return;
    }

    attempts += 1;
    paintTries();
    card.classList.remove('wrong');
    void card.offsetWidth;                  // restart the shake animation
    card.classList.add('wrong');
    value = '';
    render();
    onWrong?.(attempts);

    sfx.wrong();

    // On the last try, put the picture up without being asked. This is precisely the
    // moment counting beats guessing.
    if (attempts === maxTries - 1) setTimeout(() => showHint(false), 450);

    if (attempts >= maxTries) {
      settled = true;
      // Let the fifth miss shake and buzz like the other four, then show him the
      // answer before the grid goes -- a wipe he learns nothing from is just a
      // punishment.
      setTimeout(() => {
        sfx.outOfTries();
        card.classList.remove('wrong');
        card.classList.add('reveal');
        slot.textContent = String(expected);
        setTimeout(() => finish(() => onOutOfTries?.()), 1500);
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
    anim.finished.catch(() => {}).then(() => {
      backdrop.remove();
      after?.();
    });
  }

  function cancel() {
    if (settled) return;
    settled = true;
    sfx.close();
    finish(() => onClose?.());
  }

  function onKey(e) {
    if (e.key >= '0' && e.key <= '9') { digit(e.key); e.preventDefault(); }
    else if (e.key === 'Backspace') { back(); e.preventDefault(); }
    else if (e.key === 'Enter' || e.key === ' ') { submit(); e.preventDefault(); }
    else if (e.key === 'Escape') { cancel(); e.preventDefault(); }
    e.stopPropagation();
  }

  window.addEventListener('keydown', onKey, true);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) cancel(); });

  return { close: cancel };
}
