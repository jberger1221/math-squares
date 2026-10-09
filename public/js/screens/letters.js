// The letters game: a big picture, its name said out loud, and two to four letters to
// choose from. Tap the one the word starts with.
//
// Like the sudoku, a wrong letter never sticks: it shakes, goes dark, and the voice
// says the word again so he can listen for the first sound. The right one says
// "see is for cat" and shows the word with its first letter lit, so the letter, the
// sound and the picture all land together.

import { go } from '../router.js';
import { sfx } from '../audio.js';
import { say, hush } from '../speech.js';
import { createDancer } from '../dancer.js';
import { playEvolution } from '../evolve.js';
import { runFireworks } from '../fireworks.js';
import {
  LETTER_LEVELS, LETTER_NAMES, lettersById, lettersRecordId, makeRounds, makeChoices, wordInfo,
  wordClip, letterClip,
} from '../letters/words.js';
import {
  getProfile, session, evolutionStage, puzzleRecord, puzzleTriesOn, recordPuzzleCorrect,
  recordPuzzleMiss, completePuzzle, resetPuzzle, save, saveNow, setMuted,
} from '../state.js';

let dancer = null;
let stopFireworks = null;
let keyHandler = null;
let activeRun = null;

const NEXT_PICTURE_MS = 2200;   // long enough to hear "see is for cat" and see the word

export function mount(el, { id }) {
  const run = { live: true };
  activeRun = run;

  const profile = getProfile();
  const level = lettersById(id);
  const saveId = lettersRecordId(id);

  let rec = puzzleRecord(saveId);
  if (rec.completed) { rec = resetPuzzle(saveId); rec.order = null; }

  // The pictures are chosen once and kept, so a half-finished level comes back with
  // the same pictures still to go, and a finished one is a new set next time.
  if (!rec.order?.length) { rec.order = makeRounds(level); save(); }
  const order = rec.order;
  const total = order.length;

  const startedAt = performance.now();
  let runScore = 0;
  let finished = false;
  let round = -1;          // index into `order` of the picture on screen
  let answered = false;    // the right letter is in; waiting for the next picture
  let buttons = [];

  // ---- HUD ------------------------------------------------------------------

  const hud = document.createElement('div');
  hud.className = 'hud';

  const back = document.createElement('button');
  back.textContent = '←';
  back.setAttribute('aria-label', 'back to letters');
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
    if (session.muted) hush();
    else { sfx.navigate(); sayWord(); }
  });
  const paintMute = () => {
    mute.textContent = session.muted ? '🔇' : '🔊';
    mute.setAttribute('aria-label', session.muted ? 'unmute' : 'mute');
  };
  paintMute();

  hud.append(back, who, scoreEl, streakEl, spacer, progressEl, mute);

  // ---- the picture and the letters ------------------------------------------

  const picture = document.createElement('button');
  picture.className = 'lt-picture';
  picture.setAttribute('aria-label', 'say the word again');
  picture.addEventListener('click', () => { if (!finished) sayWord(); });

  const art = document.createElement('span');
  art.className = 'lt-art';

  const ear = document.createElement('span');
  ear.className = 'lt-ear';
  ear.textContent = '🔈';         // tap the picture to hear it again

  const spelled = document.createElement('span');
  spelled.className = 'lt-word';

  picture.append(art, ear, spelled);

  const choices = document.createElement('div');
  choices.className = 'lt-choices';

  const play = document.createElement('div');
  play.className = 'lt-play';
  play.append(picture, choices);

  const stage = document.createElement('div');
  stage.className = 'stage lt-stage';

  const canvas = document.createElement('canvas');
  canvas.className = 'dancer';
  dancer = createDancer(canvas, { stage: evolutionStage() });

  stage.append(play, canvas);
  el.append(hud, stage);
  paintHud();

  // ---- play -----------------------------------------------------------------

  // Declarations, not consts: paintHud() runs during mount, above this line.
  function solvedCount() { return Object.keys(rec.filled).length; }
  function current() { return wordInfo(order[round]); }

  function paintHud() {
    scoreEl.textContent = `⭐ ${profile.totalScore}`;
    streakEl.textContent = `🔥 ${session.streak}`;
    streakEl.classList.toggle('hot', session.streak >= 3);
    progressEl.textContent = `${solvedCount()}/${total}`;
  }

  function sayWord() {
    if (round >= 0) say(current().word, wordClip(current().word));
  }

  /** Put up the next picture he has not answered yet. */
  function nextPicture() {
    if (!run.live || finished) return;
    round = order.findIndex((_, i) => !(String(i) in rec.filled));
    if (round === -1) { finish(); return; }
    answered = false;

    const { word, picture: emoji, letter } = current();
    art.textContent = emoji;
    picture.setAttribute('aria-label', `${word}. Tap to hear it again.`);
    spelled.replaceChildren();
    picture.classList.remove('lt-right');
    picture.animate(
      [{ transform: 'scale(0.3)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }],
      { duration: 350, easing: 'ease-out' },
    );

    choices.replaceChildren();
    buttons = makeChoices(level, letter).map((choice) => {
      const b = document.createElement('button');
      b.className = 'lt-letter';
      b.dataset.letter = choice;
      // Big capital, little lowercase underneath: both are on every page he will read.
      b.innerHTML = `<span class="up">${choice}</span><span class="low">${choice.toLowerCase()}</span>`;
      b.setAttribute('aria-label', `letter ${choice}`);
      b.addEventListener('click', () => pick(choice, b));
      choices.append(b);
      return b;
    });
    choices.style.setProperty('--n', buttons.length);

    setTimeout(sayWord, 250);
    buttons[0]?.focus();
  }

  function pick(choice, button) {
    if (!run.live || finished || answered || button.disabled) return;
    const { word, letter } = current();
    const key = String(round);

    if (choice !== letter) {
      recordPuzzleMiss(saveId, key, puzzleTriesOn(saveId, key) + 1);
      button.classList.remove('bad');
      void button.offsetWidth;          // restart the shake
      button.classList.add('bad');
      button.disabled = true;           // one less to choose from, never a dead end
      sfx.wrong();
      dancer.play('sad');
      setTimeout(() => say(word, wordClip(word)), 350); // listen again for the first sound
      paintHud();
      return;
    }

    answered = true;
    const clean = puzzleTriesOn(saveId, key) === 0;
    runScore += recordPuzzleCorrect(saveId, key, clean);
    button.classList.add('good');
    buttons.forEach((b) => { if (b !== button) b.disabled = true; });
    picture.classList.add('lt-right');

    // Spell the word under the picture with its first letter lit up.
    const first = document.createElement('b');
    first.textContent = word[0];
    spelled.replaceChildren(first, word.slice(1));

    sfx.correct();
    dancer.play('dance');
    setTimeout(() => say(`${LETTER_NAMES[letter]} is for ${word}`, letterClip(letter, word)), 300);
    paintHud();

    setTimeout(() => {
      if (solvedCount() === total) finish();
      else nextPicture();
    }, NEXT_PICTURE_MS);
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

    const index = LETTER_LEVELS.findIndex((l) => l.id === id);
    const nextLevel = LETTER_LEVELS[index + 1];
    if (nextLevel) setTimeout(() => sfx.unlockChime(), 1400);

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

    if (nextLevel) {
      const nextBtn = document.createElement('button');
      nextBtn.className = 'neon-green';
      nextBtn.style.borderColor = 'var(--green)';
      nextBtn.textContent = `NEXT ▶ ${nextLevel.letters.length > 6 ? 'A–Z' : nextLevel.letters.join(' ')}`;
      nextBtn.addEventListener('click', () => {
        cleanupCelebration(banner);
        go('letters', { id: nextLevel.id });
      });
      row.append(nextBtn);
    }

    const menuBtn = document.createElement('button');
    menuBtn.textContent = '☰ MENU';
    menuBtn.addEventListener('click', () => {
      cleanupCelebration(banner);
      go('lettersselect');
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
    hush();
    await saveNow();
    go('lettersselect');
  }

  /** Type the letter on a keyboard, Space hears the word again, Escape leaves. */
  keyHandler = (e) => {
    if (finished) return;
    if (e.key === 'Escape') { leave(); return; }
    if (e.key === ' ' && document.activeElement === document.body) { sayWord(); e.preventDefault(); return; }
    const typed = e.key.length === 1 ? e.key.toUpperCase() : '';
    const button = buttons.find((b) => b.dataset.letter === typed);
    if (button) { pick(typed, button); e.preventDefault(); }
  };
  window.addEventListener('keydown', keyHandler);

  nextPicture();
}

export function unmount() {
  if (activeRun) activeRun.live = false;
  activeRun = null;
  hush();
  dancer?.destroy();
  dancer = null;
  stopFireworks?.();
  stopFireworks = null;
  document.querySelector('.fireworks')?.remove();
  document.querySelector('.clear-banner')?.remove();
  if (keyHandler) { window.removeEventListener('keydown', keyHandler); keyHandler = null; }
}
