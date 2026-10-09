// A level: the grid, the pop-out, the dancer, and the fireworks at the end.

import { go } from '../router.js';
import { sfx } from '../audio.js';
import { createGrid } from '../grid.js';
import { openPopout } from '../popout.js';
import { createDancer } from '../dancer.js';
import { playEvolution } from '../evolve.js';
import { runFireworks } from '../fireworks.js';
import { OPS, LEVELS, cellKey, operands, answerFor, maxAnswer, gridSize, isUnlocked, levelRange } from '../levels.js';
import {
  getProfile, session, evolutionStage, levelRecord, recordCorrect, recordMiss, triesOn,
  completeLevel, resetLevelRun, saveNow, setMuted,
} from '../state.js';

let dancer = null;
let popout = null;
let stopFireworks = null;
let keyHandler = null;
let activeRun = null;   // cleared on unmount, so in-flight callbacks know to stand down

const MAX_TRIES = 5;    // wrong guesses allowed on any one square

export function mount(el, { level, op }) {
  const size = gridSize(level);
  // The pop-out finishes its animation ~400ms after a correct answer. If the player
  // leaves in that window the callback still fires, so it has to be able to tell that
  // this screen is gone -- otherwise it launches fireworks over the menu.
  const run = { live: true };
  activeRun = run;

  const profile = getProfile();
  const symbol = OPS[op].symbol;

  // Replaying a finished grid starts it clean; an unfinished one picks up where he left off.
  let rec = levelRecord(op, level);
  if (rec.completed) rec = resetLevelRun(op, level);

  const solved = new Set(Object.keys(rec.filled));
  const total = size * size;
  let startedAt = performance.now();
  let runScore = 0;
  let finished = false;
  let hintSticky = false;   // once he asks for the picture, keep showing it

  // ---- HUD ------------------------------------------------------------------

  const hud = document.createElement('div');
  hud.className = 'hud';

  const back = document.createElement('button');
  back.textContent = '←';
  back.setAttribute('aria-label', 'back to levels');
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

  // ---- grid -----------------------------------------------------------------

  const grid = createGrid({ level, op, onCell: open });
  for (const key of solved) {
    const [r, c] = key.split(',').map(Number);
    grid.setSolved(r, c, answerFor(op, level, r, c), rec.filled[key], false);
  }

  const stage = document.createElement('div');
  stage.className = 'stage';

  const canvas = document.createElement('canvas');
  canvas.className = 'dancer';
  dancer = createDancer(canvas, { stage: evolutionStage() });

  stage.append(grid.el, canvas);
  el.append(hud, stage);
  paintHud();

  // ---- play -----------------------------------------------------------------

  function paintHud() {
    scoreEl.textContent = `⭐ ${profile.totalScore}`;
    streakEl.textContent = `🔥 ${session.streak}`;
    streakEl.classList.toggle('hot', session.streak >= 3);
    progressEl.textContent = `${solved.size}/${total}`;
  }

  function open(r, c, cellEl) {
    if (popout || finished || solved.has(cellKey(r, c))) return;
    const key = cellKey(r, c);
    const [a, b] = operands(op, level, r, c);
    grid.setActive(r, c, true);

    popout = openPopout({
      cellEl,
      a, b, op, symbol,
      expected: answerFor(op, level, r, c),
      hintOpen: hintSticky,
      onHint: (on = true) => { hintSticky = on; },
      maxLen: String(maxAnswer(op, level)).length,
      maxTries: MAX_TRIES,
      usedTries: triesOn(op, level, r, c),
      onWrong: (used) => {
        if (!run.live) return;
        recordMiss(op, level, r, c, used);
        dancer.play('sad');
        paintHud();
      },
      onOutOfTries: () => {
        popout = null;
        if (!run.live) return;
        grid.setActive(r, c, false);
        wipeGrid();
      },
      onCorrect: (cleanAttempt) => {
        popout = null;
        if (!run.live) return;
        grid.setActive(r, c, false);
        const firstTry = cleanAttempt && triesOn(op, level, r, c) === 0;
        solved.add(key);
        runScore += recordCorrect(op, level, r, c, firstTry);
        grid.setSolved(r, c, answerFor(op, level, r, c), firstTry, true);
        dancer.play('dance');
        paintHud();

        // He picks the next square himself -- on a big grid, choosing where to go
        // is half the fun. We only move the keyboard focus, we never open anything.
        if (solved.size === total) finish();
        else setTimeout(focusNextEmpty, 380);
      },
      onClose: () => {
        popout = null;
        if (run.live) grid.setActive(r, c, false);
      },
    });
  }

  /**
   * Five misses on one square costs the whole grid. Clear it back to empty and let
   * him start again -- his career score keeps what he already earned, so the run is
   * lost but the afternoon isn't.
   */
  function wipeGrid() {
    if (!run.live || finished) return;
    solved.clear();
    runScore = 0;
    resetLevelRun(op, level);
    grid.reset();
    paintHud();
    sfx.wipe();
    dancer.play('sad');

    const banner = document.createElement('div');
    banner.className = 'flash-banner';
    banner.innerHTML = `
      <div class="big neon-pink">OUT OF TRIES</div>
      <div class="sub neon-yellow">START THE GRID AGAIN</div>
    `;
    document.body.append(banner);

    // The banner eats taps while it is up, so an impatient jab doesn't open a square
    // behind it -- but tapping the banner itself skips ahead.
    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      banner.classList.add('leaving');
      setTimeout(() => { banner.remove(); if (run.live) focusNextEmpty(); }, 400);
    };
    banner.addEventListener('click', dismiss);
    setTimeout(dismiss, 1900);

    startedAt = performance.now();   // the clock restarts with the grid
  }

  /**
   * Put the keyboard on the next unanswered square without opening it, so tabbing
   * around stays sane after a cell is solved and disabled. Nothing pops out until
   * a square is actually chosen.
   */
  function focusNextEmpty() {
    if (popout || finished) return;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!solved.has(cellKey(r, c))) return grid.cellAt(r, c)?.focus();
      }
    }
  }

  // ---- the payoff -----------------------------------------------------------

  async function finish() {
    if (!run.live || finished) return;
    finished = true;
    const elapsed = performance.now() - startedAt;
    const result = completeLevel(op, level, elapsed, runScore);
    await saveNow();
    if (!run.live) return;
    paintHud();

    dancer.play('celebrate');
    sfx.fanfare();

    const fx = document.createElement('canvas');
    fx.className = 'fireworks';
    document.body.append(fx);
    stopFireworks = runFireworks(fx, { shells: 9, spread: 5200 });

    const nextLevel = LEVELS[LEVELS.indexOf(level) + 1];
    const justUnlocked = nextLevel && isUnlocked(profile, op, nextLevel);
    if (justUnlocked) setTimeout(() => sfx.unlockChime(), 1400);

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

    if (justUnlocked) {
      const [lo, hi] = levelRange(nextLevel);
      const nextBtn = document.createElement('button');
      nextBtn.className = 'neon-green';
      nextBtn.style.borderColor = 'var(--green)';
      nextBtn.textContent = `NEXT ▶ ${lo}–${hi}`;
      nextBtn.addEventListener('click', () => {
        cleanupCelebration(banner);
        go('game', { level: nextLevel, op });
      });
      row.append(nextBtn);
    }

    const menuBtn = document.createElement('button');
    menuBtn.textContent = '☰ MENU';
    menuBtn.addEventListener('click', () => {
      cleanupCelebration(banner);
      go('levelselect');
    });
    row.append(menuBtn);

    banner.append(evo.el, big, sub, row);
    document.body.append(banner);
    // Give the fireworks a few seconds of stage time before the buttons appear.
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
    go('levelselect');
  }

  keyHandler = (e) => {
    if (popout) return;                   // the card owns the keyboard while it is open
    // Enter and Space belong to whichever square is focused; the browser already
    // does the right thing with them, so we only claim Escape.
    if (e.key === 'Escape') leave();
  };
  window.addEventListener('keydown', keyHandler);

  // A grid that was saved full but never marked complete (the server died at exactly
  // the wrong moment) would otherwise be unfinishable. Give it its fireworks.
  if (solved.size === total) setTimeout(finish, 400);
  else focusNextEmpty();
}

export function unmount() {
  if (activeRun) activeRun.live = false;
  activeRun = null;
  popout?.close();
  popout = null;
  document.querySelector('.backdrop')?.remove();
  dancer?.destroy();
  dancer = null;
  stopFireworks?.();
  stopFireworks = null;
  document.querySelector('.fireworks')?.remove();
  document.querySelector('.clear-banner')?.remove();
  document.querySelector('.flash-banner')?.remove();
  if (keyHandler) { window.removeEventListener('keydown', keyHandler); keyHandler = null; }
}
