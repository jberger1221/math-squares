// Pick a letters level. Each tile shows the letters it teaches, and once it is open,
// a picture for each of them -- "the one with the snake" is something to point at.

import { go } from '../router.js';
import { sfx } from '../audio.js';
import { createSkipKey } from '../skipcode.js';
import { getProfile, skipTo } from '../state.js';
import {
  LETTER_LEVELS, WORDS, lettersRecordId, lettersUnlocked, suggestedLetters,
} from '../letters/words.js';

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
  heading.className = 'title-md neon-orange';
  heading.textContent = 'PICK SOME LETTERS';

  const grid = document.createElement('div');
  grid.className = 'puzzle-grid';

  const next = suggestedLetters(profile);
  let focusTile = null;
  const locked = [];   // [tile, badge, open, record id] for each one the code can open

  for (const [index, level] of LETTER_LEVELS.entries()) {
    const rec = profile.levels?.[lettersRecordId(level.id)];
    const unlocked = lettersUnlocked(profile, index);
    const started = rec && Object.keys(rec.filled || {}).length > 0 && !rec.completed;
    const everything = index === LETTER_LEVELS.length - 1;

    const tile = document.createElement('button');
    tile.className = 'puzzle-tile letters-tile';
    if (!unlocked) tile.classList.add('locked');
    else if (rec?.completed && rec?.perfect) tile.classList.add('perfect');
    else if (rec?.completed) tile.classList.add('done');
    else if (started) tile.classList.add('progress');

    const badge = document.createElement('span');
    badge.className = 'tile-badge';
    badge.textContent = !unlocked ? '🔒'
      : rec?.completed ? (rec.perfect ? '★' : '✓')
      : started ? '▶' : '';

    const letters = document.createElement('span');
    letters.className = 'tile-letters';
    letters.textContent = everything ? 'A–Z' : level.letters.join(' ');

    const pics = document.createElement('span');
    pics.className = 'tile-pics';
    // The mixed level gets a random-looking handful; the others one picture per letter.
    const shown = everything ? ['A', 'M', 'Z'] : level.letters;
    pics.textContent = unlocked ? shown.map((l) => WORDS[l][0][1]).join('') : '';

    tile.append(badge, letters, pics);
    tile.disabled = !unlocked;
    tile.setAttribute('aria-label', everything ? 'all the letters' : `letters ${level.letters.join(', ')}`);

    if (unlocked) {
      if (level.id === next) focusTile = tile;
      tile.addEventListener('click', () => { sfx.navigate(); go('letters', { id: level.id }); });
    } else {
      locked.push([tile, badge, () => go('letters', { id: level.id }), lettersRecordId(level.id)]);
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
