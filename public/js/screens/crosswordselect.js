// Pick a crossword. Each tile shows the puzzle's own shape and the pictures hiding
// inside it, so "the one with the duck" is a thing you can point at.

import { go } from '../router.js';
import { sfx } from '../audio.js';
import { createSkipKey } from '../skipcode.js';
import { getProfile, puzzleRecord, skipTo } from '../state.js';
import { PUZZLES } from '../crossword/puzzles.js';
import { buildPuzzle, BLOCK } from '../crossword/build.js';

const recordId = (id) => `cross-${id}`;

/** The grid shape in miniature: filled squares light, blocks dark. */
function shapeArt(puzzle) {
  const art = document.createElement('div');
  art.className = 'shape-art';
  art.style.gridTemplateColumns = `repeat(${puzzle.rows[0].length}, 1fr)`;
  for (const row of puzzle.rows) {
    for (const ch of row) {
      const cell = document.createElement('i');
      if (ch === BLOCK) cell.className = 'block';
      art.append(cell);
    }
  }
  return art;
}

function isUnlocked(profile, index) {
  if (index === 0) return true;
  if (profile?.levels?.[recordId(PUZZLES[index].id)]?.unlocked) return true;   // the code
  return Boolean(profile?.levels?.[recordId(PUZZLES[index - 1].id)]?.completed);
}

/** The first crossword he has not finished -- where Enter should land. */
export function suggestedPuzzle(profile) {
  for (const [i, puzzle] of PUZZLES.entries()) {
    if (!isUnlocked(profile, i)) break;
    if (!profile?.levels?.[recordId(puzzle.id)]?.completed) return puzzle.id;
  }
  return PUZZLES[PUZZLES.length - 1].id;
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
  heading.className = 'title-md neon-pink';
  heading.textContent = 'PICK A CROSSWORD';

  const grid = document.createElement('div');
  grid.className = 'puzzle-grid';

  const next = suggestedPuzzle(profile);
  let focusTile = null;
  const locked = [];   // [tile, badge, open, record id] for each one the code can open

  for (const [index, puzzle] of PUZZLES.entries()) {
    const built = buildPuzzle(puzzle);
    const rec = profile.levels?.[recordId(puzzle.id)];
    const unlocked = isUnlocked(profile, index);
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
    // Locked puzzles keep their pictures secret -- that is most of the reason to
    // want the next one.
    pics.textContent = unlocked ? built.entries.map((e) => e.picture).join('') : '';

    tile.append(badge, shapeArt(puzzle), pics);
    tile.disabled = !unlocked;
    tile.setAttribute('aria-label', `crossword ${index + 1}`);

    if (unlocked) {
      if (puzzle.id === next) focusTile = tile;
      tile.addEventListener('click', () => {
        sfx.navigate();
        go('crossword', { id: puzzle.id });
      });
    } else {
      locked.push([tile, badge, () => go('crossword', { id: puzzle.id }), recordId(puzzle.id)]);
    }
    grid.append(tile);
  }

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

  el.append(header, heading, grid);
  focusTile?.focus();
}
