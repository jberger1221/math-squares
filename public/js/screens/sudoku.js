// A sudoku board: tap an empty square, tap the fruit you want in it.
//
// There is no "check my answer" button and no way to fill the board with a wrong
// guess and then hunt for it. A square only accepts the symbol that belongs there;
// anything else shakes and stays out. That turns the puzzle into what it actually is
// at this age -- looking along a row and noticing what is missing -- instead of an
// exercise in bookkeeping.

import { go } from '../router.js';
import { sfx } from '../audio.js';
import { createDancer } from '../dancer.js';
import { runFireworks } from '../fireworks.js';
import { makeSudoku, shapeFor } from '../sudoku/generate.js';
import { SUDOKU_LEVELS, sudokuById, sudokuRecordId } from '../sudoku/levels.js';
import {
  getProfile, session, puzzleRecord, puzzleTriesOn, recordPuzzleCorrect,
  recordPuzzleMiss, completePuzzle, resetPuzzle, save, saveNow, setMuted,
} from '../state.js';

let dancer = null;
let stopFireworks = null;
let keyHandler = null;
let activeRun = null;

export function mount(el, { id }) {
  const run = { live: true };
  activeRun = run;

  const profile = getProfile();
  const level = sudokuById(id);
  const saveId = sudokuRecordId(id);
  const { n, symbols } = level;
  const { boxW, boxH } = shapeFor(n);

  let rec = puzzleRecord(saveId);
  if (rec.completed) { rec = resetPuzzle(saveId); rec.seed = 0; }

  // The board is regenerated from a seed rather than stored square by square. Keeping
  // the seed means a half-finished puzzle comes back exactly as he left it, and a
  // finished one is a brand new board next time.
  if (!rec.seed) { rec.seed = Math.floor(Math.random() * 2 ** 31); save(); }
  const puzzle = makeSudoku({ n, clues: level.clues, seed: rec.seed });

  const blanks = puzzle.given.reduce((count, v) => count + (v === 0 ? 1 : 0), 0);
  const filled = new Map();                 // "r,c" -> true if it went in first try
  for (const [key, clean] of Object.entries(rec.filled)) filled.set(key, clean);

  const startedAt = performance.now();
  let runScore = 0;
  let finished = false;
  let selected = null;                      // "r,c" of the square waiting for a symbol

  // ---- HUD ------------------------------------------------------------------

  const hud = document.createElement('div');
  hud.className = 'hud';

  const back = document.createElement('button');
  back.textContent = '←';
  back.setAttribute('aria-label', 'back to sudokus');
  back.addEventListener('click', leave);

  const who = document.createElement('span');
  who.className = 'hud-item neon-yellow';
  who.textContent = profile.name;

  const scoreEl = document.createElement('span');
  scoreEl.className = 'hud-item';

  const streakEl = document.createElement('span');
  streakEl.id = 'hud-streak';
  streakEl.className = 'hud-item';

  const progressEl = document.createElement('span');
  progressEl.className = 'hud-item neon';

  const spacer = document.createElement('span');
  spacer.className = 'hud-spacer';

  const hintBtn = document.createElement('button');
  hintBtn.textContent = '💡';
  hintBtn.setAttribute('aria-label', 'fill in one square');
  hintBtn.addEventListener('click', giveOne);

  const mute = document.createElement('button');
  mute.addEventListener('click', () => {
    setMuted(!session.muted);
    paintMute();
    if (!session.muted) sfx.navigate();
  });
  const paintMute = () => {
    mute.textContent = session.muted ? '🔇' : '🔊';
    mute.setAttribute('aria-label', session.muted ? 'unmute' : 'mute');
  };
  paintMute();

  hud.append(back, who, scoreEl, streakEl, spacer, progressEl, hintBtn, mute);

  // ---- the board ------------------------------------------------------------

  const board = document.createElement('div');
  board.className = 'sud-grid';
  board.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
  board.style.setProperty('--sud-n', n);

  const cells = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const index = r * n + c;
      const cell = document.createElement('button');
      cell.className = 'sud-cell';
      // The heavy lines are what make a box a box, so draw them on the squares.
      if ((c + 1) % boxW === 0 && c < n - 1) cell.classList.add('edge-r');
      if ((r + 1) % boxH === 0 && r < n - 1) cell.classList.add('edge-b');
      cell.dataset.key = `${r},${c}`;
      cell.setAttribute('aria-label', `row ${r + 1}, column ${c + 1}`);
      cell.addEventListener('click', () => choose(r, c));
      cells.push(cell);
      board.append(cell);
    }
  }

  // ---- the palette ----------------------------------------------------------

  const palette = document.createElement('div');
  palette.className = 'sud-palette';
  palette.style.setProperty('--pal-n', n);
  palette.style.setProperty('--pal-cols', n > 4 ? 3 : 2);
  const paletteButtons = [];

  for (let v = 1; v <= n; v++) {
    const key = document.createElement('button');
    key.className = 'sud-key';
    key.textContent = symbols[v - 1];
    key.setAttribute('aria-label', `place ${v}`);
    key.addEventListener('click', () => place(v));
    palette.append(key);
    paletteButtons.push(key);
  }

  const stage = document.createElement('div');
  stage.className = 'stage sud-stage';

  const canvas = document.createElement('canvas');
  canvas.className = 'dancer';
  dancer = createDancer(canvas);

  stage.append(board, palette, canvas);
  el.append(hud, stage);

  paintBoard();
  paintHud();

  // ---- painting -------------------------------------------------------------

  // A declaration, not a const: paintBoard() runs during mount, above this line.
  function valueAt(index) {
    const key = `${Math.floor(index / n)},${index % n}`;
    if (puzzle.given[index]) return puzzle.given[index];
    return filled.has(key) ? puzzle.solution[index] : 0;
  }

  function paintBoard() {
    cells.forEach((cell, index) => {
      const key = cell.dataset.key;
      const value = valueAt(index);
      cell.textContent = value ? symbols[value - 1] : '';
      cell.classList.toggle('given', Boolean(puzzle.given[index]));
      cell.classList.toggle('solved-perfect', filled.get(key) === true);
      cell.classList.toggle('solved', filled.get(key) === false);
      cell.classList.toggle('empty', !value);
      cell.disabled = Boolean(value);
    });
    paintSelection();
    paintPalette();
  }

  /** Light the chosen square, and dim everything that is not in its row, column or box. */
  function paintSelection() {
    const [sr, sc] = selected ? selected.split(',').map(Number) : [-1, -1];
    cells.forEach((cell, index) => {
      const r = Math.floor(index / n);
      const c = index % n;
      const sameBox = selected !== null
        && Math.floor(r / boxH) === Math.floor(sr / boxH)
        && Math.floor(c / boxW) === Math.floor(sc / boxW);
      cell.classList.toggle('sel', cell.dataset.key === selected);
      cell.classList.toggle('peer', selected !== null && cell.dataset.key !== selected
        && (r === sr || c === sc || sameBox));
    });
  }

  /** Grey out a symbol once all of it is on the board -- one less thing to try. */
  function paintPalette() {
    const used = new Array(n + 1).fill(0);
    cells.forEach((_, index) => { const v = valueAt(index); if (v) used[v] += 1; });
    paletteButtons.forEach((key, i) => key.classList.toggle('spent', used[i + 1] >= n));
  }

  function paintHud() {
    scoreEl.textContent = `⭐ ${profile.totalScore}`;
    streakEl.textContent = `🔥 ${session.streak}`;
    streakEl.classList.toggle('hot', session.streak >= 3);
    progressEl.textContent = `${filled.size}/${blanks}`;
  }

  // ---- play -----------------------------------------------------------------

  function choose(r, c) {
    if (finished) return;
    const key = `${r},${c}`;
    const index = r * n + c;
    if (puzzle.given[index] || filled.has(key)) return;
    selected = selected === key ? null : key;
    sfx.navigate();
    paintSelection();
  }

  function place(value) {
    if (finished || !selected) { sfx.back(); return; }
    const [r, c] = selected.split(',').map(Number);
    const index = r * n + c;
    const key = selected;
    const cell = cells[index];

    if (puzzle.solution[index] !== value) {
      const used = puzzleTriesOn(saveId, key) + 1;
      recordPuzzleMiss(saveId, key, used);
      // Show the wrong symbol for as long as the shake lasts, so the miss is about
      // the answer and not about whether the tap registered.
      cell.textContent = symbols[value - 1];
      cell.classList.remove('bad');
      void cell.offsetWidth;
      cell.classList.add('bad');
      sfx.wrong();
      dancer.play('sad');
      setTimeout(() => {
        if (!run.live) return;
        cell.classList.remove('bad');
        cell.textContent = '';
      }, 480);
      paintHud();
      return;
    }

    accept(key, puzzleTriesOn(saveId, key) === 0);
  }

  /** A square goes in for good. `clean` decides gold or green. */
  function accept(key, clean) {
    const [r, c] = key.split(',').map(Number);
    filled.set(key, clean);
    runScore += recordPuzzleCorrect(saveId, key, clean);
    selected = null;
    paintBoard();
    const cell = cells[r * n + c];
    cell.classList.remove('just-solved');
    void cell.offsetWidth;
    cell.classList.add('just-solved');
    sfx.correct();
    dancer.play('dance');
    paintHud();
    if (filled.size === blanks) finish();
  }

  /** The 💡: fill in the chosen square, or the first empty one. Never a dead end. */
  function giveOne() {
    if (finished) return;
    let key = selected;
    if (!key) {
      const index = cells.findIndex((_, i) => !valueAt(i));
      if (index === -1) return;
      key = cells[index].dataset.key;
    }
    // A given square is never selectable, so anything we land on here is fair game.
    sfx.hint();
    accept(key, false);
  }

  // ---- the payoff -----------------------------------------------------------

  async function finish() {
    if (!run.live || finished) return;
    finished = true;
    const result = completePuzzle(saveId, blanks, performance.now() - startedAt, runScore);
    await saveNow();
    if (!run.live) return;
    paintHud();

    dancer.play('celebrate');
    sfx.fanfare();

    const fx = document.createElement('canvas');
    fx.className = 'fireworks';
    document.body.append(fx);
    stopFireworks = runFireworks(fx, { shells: 9, spread: 5200 });

    const index = SUDOKU_LEVELS.findIndex((l) => l.id === id);
    const nextLevel = SUDOKU_LEVELS[index + 1];
    if (nextLevel) setTimeout(() => sfx.unlockChime(), 1400);

    const banner = document.createElement('div');
    banner.className = 'clear-banner';

    const big = document.createElement('div');
    big.className = `big ${result.perfect ? 'neon-yellow' : 'neon-green'}`;
    big.textContent = result.perfect ? '★ PERFECT ★' : 'ALL DONE!';

    const sub = document.createElement('div');
    sub.className = 'sub neon';
    sub.textContent = `+${result.total}`;

    const row = document.createElement('div');
    row.className = 'row';

    if (nextLevel) {
      const nextBtn = document.createElement('button');
      nextBtn.className = 'neon-green';
      nextBtn.style.borderColor = 'var(--green)';
      nextBtn.textContent = `NEXT ▶ ${nextLevel.n}×${nextLevel.n}`;
      nextBtn.addEventListener('click', () => {
        cleanupCelebration(banner);
        go('sudoku', { id: nextLevel.id });
      });
      row.append(nextBtn);
    }

    const menuBtn = document.createElement('button');
    menuBtn.textContent = '☰ MENU';
    menuBtn.addEventListener('click', () => {
      cleanupCelebration(banner);
      go('sudokuselect');
    });
    row.append(menuBtn);

    banner.append(big, sub, row);
    document.body.append(banner);
    row.style.opacity = '0';
    row.style.transition = 'opacity 600ms';
    setTimeout(() => { row.style.opacity = '1'; }, 2600);
  }

  function cleanupCelebration(banner) {
    stopFireworks?.();
    stopFireworks = null;
    document.querySelector('.fireworks')?.remove();
    banner.remove();
  }

  async function leave() {
    await saveNow();
    go('sudokuselect');
  }

  /** Arrows walk the board, 1-9 place, Escape leaves. */
  keyHandler = (e) => {
    if (finished) return;
    const step = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
    if (step) {
      // Walk one square at a time, wrapping at the edges, until an empty one turns
      // up. Skipping the settled squares keeps arrowing around useful late in a board.
      let [r, c] = selected ? selected.split(',').map(Number) : [0, 0 - step[1]];
      for (let i = 0; i < n * n; i++) {
        r = (r + step[0] + n) % n;
        c = (c + step[1] + n) % n;
        const key = `${r},${c}`;
        if (!puzzle.given[r * n + c] && !filled.has(key)) { selected = key; break; }
      }
      paintSelection();
      e.preventDefault();
      return;
    }
    const digit = Number(e.key);
    if (digit >= 1 && digit <= n) { place(digit); e.preventDefault(); return; }
    if (e.key === 'Escape') leave();
  };
  window.addEventListener('keydown', keyHandler);

  if (filled.size === blanks) setTimeout(finish, 400);
}

export function unmount() {
  if (activeRun) activeRun.live = false;
  activeRun = null;
  dancer?.destroy();
  dancer = null;
  stopFireworks?.();
  stopFireworks = null;
  document.querySelector('.fireworks')?.remove();
  document.querySelector('.clear-banner')?.remove();
  if (keyHandler) { window.removeEventListener('keydown', keyHandler); keyHandler = null; }
}
