// Pick a grid. Each tile draws its own size in dots, so it reads without reading, and
// says which numbers are on it -- from 5 up every grid is 5x5, and the numbers are the
// difference.

import { go } from '../router.js';
import { sfx } from '../audio.js';
import { createSkipKey } from '../skipcode.js';
import { getProfile, session, levelRecord, skipTo } from '../state.js';
import { levelList, isUnlocked, suggestedLevel, gridSize, levelRange } from '../levels.js';

function dots(size) {
  const box = document.createElement('div');
  box.className = 'tile-dots';
  box.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
  box.style.gridTemplateRows = `repeat(${size}, 1fr)`;
  for (let i = 0; i < size * size; i++) box.append(document.createElement('i'));
  return box;
}

export function mount(el) {
  const profile = getProfile();
  const op = session.op;

  const header = document.createElement('div');
  header.className = 'row';

  // The way back out to the other two games. Every picker has one in the same corner.
  const back = document.createElement('button');
  back.className = 'chip';
  back.textContent = '←';
  back.setAttribute('aria-label', 'back to games');
  back.addEventListener('click', () => { sfx.back(); go('gamepick'); });

  const summary = document.createElement('span');
  summary.className = 'row';
  summary.innerHTML = `
    <span class="title-md neon-yellow">${profile.name}</span>
    <span class="title-sm">SCORE ${profile.totalScore}</span>
    <span class="title-sm">BEST STREAK ${profile.bestStreak}</span>
  `;
  header.append(back, summary);

  const heading = document.createElement('h2');
  heading.className = 'title-md neon';
  heading.textContent = 'PICK A GRID';

  const grid = document.createElement('div');
  grid.className = 'level-grid';

  const next = suggestedLevel(profile, op);
  let focusTile = null;   // where he left off, so Enter just carries on
  const locked = [];      // [tile, badge, open, record id] for each one the code can open

  for (const level of levelList(op)) {
    const rec = profile.levels?.[level.id];
    const unlocked = isUnlocked(profile, op, level.level);
    const started = rec && Object.keys(rec.filled || {}).length > 0 && !rec.completed;

    const tile = document.createElement('button');
    tile.className = 'level-tile';
    if (!unlocked) tile.classList.add('locked');
    else if (rec?.perfect && rec?.completed) tile.classList.add('perfect');
    else if (rec?.completed) tile.classList.add('done');
    else if (started) tile.classList.add('progress');

    const badge = document.createElement('span');
    badge.className = 'tile-badge';
    badge.textContent = !unlocked ? '🔒'
      : rec?.completed ? (rec.perfect ? '★' : '✓')
      : started ? '▶' : '';

    const label = document.createElement('span');
    label.className = 'tile-size';
    const [lo, hi] = levelRange(level.level);
    label.textContent = `${lo}–${hi}`;

    tile.append(badge, dots(gridSize(level.level)), label);
    tile.disabled = !unlocked;
    tile.setAttribute('aria-label', `numbers ${lo} to ${hi}`);

    if (unlocked) {
      if (level.level === next) focusTile = tile;
      tile.addEventListener('click', () => {
        sfx.navigate();
        levelRecord(op, level.level);      // make sure the record exists before we play
        go('game', { level: level.level, op });
      });
    } else {
      locked.push([tile, badge, () => go('game', { level: level.level, op }), level.id]);
    }
    grid.append(tile);
  }

  const footer = document.createElement('div');
  footer.className = 'row';

  const scores = document.createElement('button');
  scores.className = 'chip';
  scores.textContent = '🏆 HIGH SCORES';
  scores.addEventListener('click', () => { sfx.navigate(); go('highscores'); });

  const swap = document.createElement('button');
  swap.className = 'chip';
  swap.textContent = '↺ CHANGE PLAYER';
  swap.addEventListener('click', () => { sfx.navigate(); go('nameentry'); });

  // The code turns every lock into an open padlock; tapping one jumps straight in.
  if (locked.length) {
    header.append(createSkipKey({
      onUnlocked: () => {
        for (const [tile, badge, open, id] of locked) {
          tile.disabled = false;
          tile.classList.replace('locked', 'skippable');
          badge.textContent = '🔓';
          tile.addEventListener('click', async () => {
            sfx.navigate();
            await skipTo(id);
            open();
          });
        }
        locked[0][0].focus();
      },
    }));
  }

  footer.append(scores, swap);
  el.append(header, heading, grid, footer);
  focusTile?.focus();
}
