// Pick a sudoku. The tile is the board: how big it is, and what goes in it.

import { go } from '../router.js';
import { sfx } from '../audio.js';
import { getProfile } from '../state.js';
import { SUDOKU_LEVELS, sudokuRecordId, sudokuUnlocked, suggestedSudoku } from '../sudoku/levels.js';
import { shapeFor } from '../sudoku/generate.js';

/** A miniature of the board, with the box lines drawn in. */
function boardArt(level) {
  const { boxW, boxH } = shapeFor(level.n);
  const art = document.createElement('div');
  art.className = 'shape-art board-art';
  art.style.gridTemplateColumns = `repeat(${level.n}, 1fr)`;
  for (let r = 0; r < level.n; r++) {
    for (let c = 0; c < level.n; c++) {
      const cell = document.createElement('i');
      if ((c + 1) % boxW === 0 && c < level.n - 1) cell.classList.add('edge-r');
      if ((r + 1) % boxH === 0 && r < level.n - 1) cell.classList.add('edge-b');
      art.append(cell);
    }
  }
  return art;
}

export function mount(el) {
  const profile = getProfile();

  const header = document.createElement('div');
  header.className = 'row';

  const back = document.createElement('button');
  back.className = 'chip';
  back.textContent = '←';
  back.setAttribute('aria-label', 'back to games');
  back.addEventListener('click', () => { sfx.back(); go('gamepick'); });

  const who = document.createElement('span');
  who.className = 'title-md neon-yellow';
  who.textContent = profile.name;

  header.append(back, who);

  const heading = document.createElement('h2');
  heading.className = 'title-md neon-green';
  heading.textContent = 'PICK A SUDOKU';

  const grid = document.createElement('div');
  grid.className = 'puzzle-grid';

  const next = suggestedSudoku(profile);
  let focusTile = null;

  for (const [index, level] of SUDOKU_LEVELS.entries()) {
    const rec = profile.levels?.[sudokuRecordId(level.id)];
    const unlocked = sudokuUnlocked(profile, index);
    const started = rec && Object.keys(rec.filled || {}).length > 0 && !rec.completed;

    const tile = document.createElement('button');
    tile.className = 'puzzle-tile';
    if (!unlocked) tile.classList.add('locked');
    else if (rec?.completed && rec?.perfect) tile.classList.add('perfect');
    else if (rec?.completed) tile.classList.add('done');
    else if (started) tile.classList.add('progress');

    const badge = document.createElement('span');
    badge.className = 'tile-badge';
    badge.textContent = !unlocked ? '🔒'
      : rec?.completed ? (rec.perfect ? '★' : '✓')
      : started ? '▶' : '';

    const pics = document.createElement('span');
    pics.className = 'tile-pics';
    // Two fruit is enough to say "this is the fruit one"; the digit boards say 1 2 3.
    pics.textContent = unlocked ? level.symbols.slice(0, 3).join('') : '';

    tile.append(badge, boardArt(level), pics);
    tile.disabled = !unlocked;
    tile.setAttribute('aria-label', `${level.n} by ${level.n} sudoku`);

    if (unlocked) {
      if (level.id === next) focusTile = tile;
      tile.addEventListener('click', () => { sfx.navigate(); go('sudoku', { id: level.id }); });
    }
    grid.append(tile);
  }

  el.append(header, heading, grid);
  focusTile?.focus();
}
