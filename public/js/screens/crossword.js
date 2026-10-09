// A crossword: the grid, the picture clues down the side, and the fireworks at the end.

import { go } from '../router.js';
import { sfx } from '../audio.js';
import { createDancer } from '../dancer.js';
import { playEvolution } from '../evolve.js';
import { runFireworks } from '../fireworks.js';
import { puzzleById, PUZZLES } from '../crossword/puzzles.js';
import { buildPuzzle } from '../crossword/build.js';
import { openWordCard } from '../crossword/wordcard.js';
import {
  getProfile, session, evolutionStage, puzzleRecord, puzzleTriesOn, recordPuzzleCorrect,
  recordPuzzleMiss, completePuzzle, resetPuzzle, saveNow, setMuted,
} from '../state.js';

let dancer = null;
let card = null;
let stopFireworks = null;
let keyHandler = null;
let activeRun = null;

const recordId = (id) => `cross-${id}`;

export function mount(el, { id }) {
  const run = { live: true };
  activeRun = run;

  const profile = getProfile();
  const puzzle = puzzleById(id);
  const built = buildPuzzle(puzzle);
  const saveId = recordId(id);

  let rec = puzzleRecord(saveId);
  if (rec.completed) rec = resetPuzzle(saveId);

  // A word is "solved" by entry id; the letters on the grid follow from that, so
  // nothing has to be stored cell by cell.
  const solved = new Map();                 // entry id -> true if it was a clean solve
  for (const [key, clean] of Object.entries(rec.filled)) solved.set(key, clean);

  const total = built.entries.length;
  let startedAt = performance.now();
  let runScore = 0;
  let finished = false;

  // ---- HUD ------------------------------------------------------------------

  const hud = document.createElement('div');
  hud.className = 'hud';

  const back = document.createElement('button');
  back.textContent = '←';
  back.setAttribute('aria-label', 'back to crosswords');
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

  hud.append(back, who, scoreEl, streakEl, spacer, progressEl, mute);

  // ---- the grid -------------------------------------------------------------

  const board = document.createElement('div');
  board.className = 'xw-grid';
  board.style.gridTemplateColumns = `repeat(${built.cols}, 1fr)`;
  board.style.setProperty('--xw-cols', built.cols);

  const cells = new Map();                  // "r,c" -> the button
  // Only an entry's first square wears its number, exactly as in a newspaper.
  const numberAt = new Map();
  for (const entry of built.entries) {
    const [r, c] = entry.cells[0];
    numberAt.set(`${r},${c}`, entry.number);
  }

  for (let r = 0; r < built.rows; r++) {
    for (let c = 0; c < built.cols; c++) {
      const key = `${r},${c}`;
      if (!built.open(r, c)) {
        const block = document.createElement('div');
        block.className = 'xw-cell block';
        board.append(block);
        continue;
      }

      const cell = document.createElement('button');
      cell.className = 'xw-cell';
      cell.setAttribute('aria-label', `square ${r + 1}, ${c + 1}`);

      if (numberAt.has(key)) {
        const num = document.createElement('i');
        num.className = 'xw-number';
        num.textContent = numberAt.get(key);
        cell.append(num);
      }

      const letter = document.createElement('span');
      letter.className = 'xw-letter';
      cell.append(letter);

      cell.addEventListener('click', () => openAt(r, c));
      cells.set(key, cell);
      board.append(cell);
    }
  }

  // ---- the clues ------------------------------------------------------------
  //
  // A picture per word, numbered to match the grid. It doubles as the way in: tap
  // the duck and the duck's word opens.

  const clueRail = document.createElement('div');
  clueRail.className = 'clue-rail';
  const clueButtons = new Map();

  for (const entry of built.entries) {
    const clue = document.createElement('button');
    clue.className = `clue ${entry.dir}`;
    clue.setAttribute('aria-label', `clue ${entry.number} ${entry.dir}: ${entry.word}`);
    clue.innerHTML =
      `<i class="clue-number">${entry.number}${entry.dir === 'down' ? '↓' : '→'}</i>` +
      `<span class="clue-pic">${entry.picture}</span>`;
    clue.addEventListener('click', () => openEntry(entry));
    clueRail.append(clue);
    clueButtons.set(entry.id, clue);
  }

  const stage = document.createElement('div');
  stage.className = 'stage xw-stage';

  const canvas = document.createElement('canvas');
  canvas.className = 'dancer';
  dancer = createDancer(canvas, { stage: evolutionStage() });

  stage.append(board, clueRail, canvas);
  el.append(hud, stage);

  for (const [entryId, clean] of solved) paintEntry(entryId, clean, false);
  paintHud();

  // ---- play -----------------------------------------------------------------

  function paintHud() {
    scoreEl.textContent = `⭐ ${profile.totalScore}`;
    streakEl.textContent = `🔥 ${session.streak}`;
    streakEl.classList.toggle('hot', session.streak >= 3);
    progressEl.textContent = `${solved.size}/${total}`;
  }

  const entryById = (entryId) => built.entries.find((e) => e.id === entryId);

  /** Write a solved word onto the grid and grey out its picture. */
  function paintEntry(entryId, clean, animate) {
    const entry = entryById(entryId);
    if (!entry) return;
    entry.cells.forEach(([r, c], i) => {
      const cell = cells.get(`${r},${c}`);
      if (!cell) return;
      cell.querySelector('.xw-letter').textContent = entry.word[i];
      // A square is gold if any word running through it was solved cleanly -- the
      // letter was earned once, and crossing it later should not tarnish it.
      if (clean) { cell.classList.remove('solved'); cell.classList.add('solved-perfect'); }
      else if (!cell.classList.contains('solved-perfect')) cell.classList.add('solved');
      if (animate) {
        cell.classList.remove('just-solved');
        void cell.offsetWidth;
        cell.classList.add('just-solved');
      }
    });
    clueButtons.get(entryId)?.classList.add('done');
  }

  /** Every letter of this word already standing on the grid, from crossing words. */
  function knownLetters(entry) {
    const known = new Map();
    entry.cells.forEach(([r, c], i) => {
      const cell = cells.get(`${r},${c}`);
      if (cell?.querySelector('.xw-letter').textContent) known.set(i, entry.word[i]);
    });
    return known;
  }

  /** Tapping a square: open whichever of its words is still unsolved. */
  function openAt(r, c) {
    const owners = built.cellEntries.get(`${r},${c}`) || [];
    const entry = owners.find((e) => !solved.has(e.id));
    if (entry) openEntry(entry);
    else sfx.close();
  }

  function openEntry(entry) {
    if (card || finished || solved.has(entry.id)) return;
    const [r, c] = entry.cells[0];
    const cellEl = cells.get(`${r},${c}`);

    for (const [rr, cc] of entry.cells) cells.get(`${rr},${cc}`)?.classList.add('active');
    clueButtons.get(entry.id)?.classList.add('active');

    card = openWordCard({
      cellEl,
      entry,
      known: knownLetters(entry),
      usedTries: puzzleTriesOn(saveId, entry.id),
      onWrong: (used) => {
        if (!run.live) return;
        recordPuzzleMiss(saveId, entry.id, used);
        dancer.play('sad');
        paintHud();
      },
      onCorrect: (firstTry) => {
        card = null;
        if (!run.live) return;
        clearActive(entry);
        const clean = firstTry && puzzleTriesOn(saveId, entry.id) === 0;
        solved.set(entry.id, clean);
        runScore += recordPuzzleCorrect(saveId, entry.id, clean);
        paintEntry(entry.id, clean, true);
        dancer.play('dance');
        paintHud();
        if (solved.size === total) finish();
        else setTimeout(focusNextClue, 380);
      },
      onClose: () => {
        card = null;
        if (run.live) clearActive(entry);
      },
    });
  }

  function clearActive(entry) {
    for (const [r, c] of entry.cells) cells.get(`${r},${c}`)?.classList.remove('active');
    clueButtons.get(entry.id)?.classList.remove('active');
  }

  /** Move the keyboard onto the next unsolved picture without opening it. */
  function focusNextClue() {
    if (card || finished) return;
    const next = built.entries.find((e) => !solved.has(e.id));
    if (next) clueButtons.get(next.id)?.focus();
  }

  // ---- the payoff -----------------------------------------------------------

  async function finish() {
    if (!run.live || finished) return;
    finished = true;
    const result = completePuzzle(saveId, total, performance.now() - startedAt, runScore);
    await saveNow();
    if (!run.live) return;
    paintHud();

    dancer.play('celebrate');
    sfx.fanfare();

    const fx = document.createElement('canvas');
    fx.className = 'fireworks';
    document.body.append(fx);
    stopFireworks = runFireworks(fx, { shells: 9, spread: 5200 });

    const index = PUZZLES.findIndex((p) => p.id === id);
    const nextPuzzle = PUZZLES[index + 1];
    if (nextPuzzle) setTimeout(() => sfx.unlockChime(), 1400);

    const banner = document.createElement('div');
    banner.className = 'clear-banner';

    // The big version of him takes the stage dancer's place while he evolves.
    const evo = playEvolution(result.evolution);
    canvas.style.visibility = 'hidden';
    dancer.setLook({ stage: result.evolution.to });

    const big = document.createElement('div');
    big.className = `big ${result.perfect ? 'neon-yellow' : 'neon-green'}`;
    big.textContent = result.perfect ? '★ PERFECT ★' : 'ALL DONE!';

    const sub = document.createElement('div');
    sub.className = 'sub neon';
    sub.textContent = `+${result.total}`;

    const row = document.createElement('div');
    row.className = 'row';

    if (nextPuzzle) {
      const nextBtn = document.createElement('button');
      nextBtn.className = 'neon-green';
      nextBtn.style.borderColor = 'var(--green)';
      nextBtn.textContent = 'NEXT ▶';
      nextBtn.addEventListener('click', () => {
        cleanupCelebration(banner);
        go('crossword', { id: nextPuzzle.id });
      });
      row.append(nextBtn);
    }

    const menuBtn = document.createElement('button');
    menuBtn.textContent = '☰ MENU';
    menuBtn.addEventListener('click', () => {
      cleanupCelebration(banner);
      go('crosswordselect');
    });
    row.append(menuBtn);

    banner.append(evo.el, big, sub, row);
    document.body.append(banner);
    row.style.opacity = '0';
    row.style.transition = 'opacity 600ms';
    setTimeout(() => { row.style.opacity = '1'; }, Math.max(2600, evo.ms + 600));
  }

  function cleanupCelebration(banner) {
    stopFireworks?.();
    stopFireworks = null;
    document.querySelector('.fireworks')?.remove();
    banner.remove();
  }

  async function leave() {
    await saveNow();
    go('crosswordselect');
  }

  keyHandler = (e) => {
    if (card) return;
    if (e.key === 'Escape') leave();
  };
  window.addEventListener('keydown', keyHandler);

  if (solved.size === total) setTimeout(finish, 400);
  else focusNextClue();
}

export function unmount() {
  if (activeRun) activeRun.live = false;
  activeRun = null;
  card?.close();
  card = null;
  document.querySelector('.backdrop')?.remove();
  dancer?.destroy();
  dancer = null;
  stopFireworks?.();
  stopFireworks = null;
  document.querySelector('.fireworks')?.remove();
  document.querySelector('.clear-banner')?.remove();
  if (keyHandler) { window.removeEventListener('keydown', keyHandler); keyHandler = null; }
}
