// Two arcade boards: career score, and the longest run with no mistakes.

import { go } from '../router.js';
import { sfx } from '../audio.js';
import { highscores } from '../api.js';
import { getProfile } from '../state.js';

function board(title, rows, unit) {
  const box = document.createElement('div');
  box.className = 'board';

  const h = document.createElement('h3');
  h.className = 'title-md neon-pink';
  h.textContent = title;

  const table = document.createElement('div');
  table.className = 'score-table';
  const me = getProfile()?.name;

  if (!rows.length) {
    const empty = document.createElement('span');
    empty.className = 'title-sm';
    empty.style.gridColumn = 'span 3';
    empty.textContent = '- NOBODY YET -';
    table.append(empty);
  }

  rows.forEach((row, i) => {
    const rank = document.createElement('span');
    rank.className = 'rank';
    rank.textContent = `${i + 1}.`;

    const name = document.createElement('span');
    name.textContent = row.name;
    if (row.name === me) name.className = 'neon-green';

    const val = document.createElement('span');
    val.className = 'val';
    val.textContent = `${row.value}${unit}`;

    table.append(rank, name, val);
  });

  box.append(h, table);
  return box;
}

export async function mount(el) {
  const h = document.createElement('h2');
  h.className = 'title-lg neon-yellow';
  h.textContent = 'HIGH SCORES';

  const pair = document.createElement('div');
  pair.className = 'board-pair';

  const backBtn = document.createElement('button');
  backBtn.textContent = '← BACK';
  backBtn.style.minHeight = '0';
  backBtn.style.padding = '1.4vmin 2.4vmin';
  backBtn.addEventListener('click', () => { sfx.navigate(); go('gamepick'); });

  el.append(h, pair, backBtn);

  const { byScore, byStreak } = await highscores();
  pair.append(
    board('⭐ SCORE', byScore, ''),
    board('🔥 NO MISTAKES', byStreak, ' IN A ROW'),
  );
}
