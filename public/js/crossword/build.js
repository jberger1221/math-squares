// Turn a finished grid into a playable crossword: where the squares are, which runs
// are entries, and what number each entry wears.

import { PICTURES } from './puzzles.js';

export const BLOCK = '.';

/**
 * Read a puzzle's `rows` into { rows, cols, letters, entries, cellEntries }.
 *
 * `entries` are every maximal run of two or more squares, across and down, numbered
 * the way a newspaper numbers them: left-to-right, top-to-bottom, a new number each
 * time a square starts a run. `cellEntries` maps "r,c" to the entries covering it,
 * so tapping a square knows which words it belongs to.
 *
 * Throws if a run has no picture. That is deliberate: a crossword with a clueless
 * word is unsolvable, and the moment to find out is now, not with a child holding
 * the iPad.
 */
export function buildPuzzle(puzzle) {
  const rows = puzzle.rows.length;
  const cols = puzzle.rows[0].length;
  for (const row of puzzle.rows) {
    if (row.length !== cols) throw new Error(`${puzzle.id}: ragged grid`);
  }

  const at = (r, c) => (r < 0 || c < 0 || r >= rows || c >= cols ? BLOCK : puzzle.rows[r][c]);
  const open = (r, c) => at(r, c) !== BLOCK;

  const letters = new Map();          // "r,c" -> the correct letter
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) if (open(r, c)) letters.set(`${r},${c}`, at(r, c));
  }

  const entries = [];
  let number = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!open(r, c)) continue;
      const startsAcross = !open(r, c - 1) && open(r, c + 1);
      const startsDown = !open(r - 1, c) && open(r + 1, c);
      if (!startsAcross && !startsDown) continue;

      number += 1;
      if (startsAcross) entries.push(makeEntry(puzzle, at, number, r, c, 0, 1));
      if (startsDown) entries.push(makeEntry(puzzle, at, number, r, c, 1, 0));
    }
  }

  const cellEntries = new Map();
  for (const entry of entries) {
    for (const [r, c] of entry.cells) {
      const key = `${r},${c}`;
      if (!cellEntries.has(key)) cellEntries.set(key, []);
      cellEntries.get(key).push(entry);
    }
  }

  return { id: puzzle.id, rows, cols, letters, entries, cellEntries, open };
}

function makeEntry(puzzle, at, number, r, c, dr, dc) {
  const cells = [];
  let word = '';
  for (let rr = r, cc = c; at(rr, cc) !== BLOCK; rr += dr, cc += dc) {
    cells.push([rr, cc]);
    word += at(rr, cc);
  }
  const picture = PICTURES[word];
  if (!picture) throw new Error(`${puzzle.id}: no picture for "${word}"`);
  return {
    id: `${number}${dr ? 'D' : 'A'}`,
    number, word, picture, cells,
    dir: dr ? 'down' : 'across',
  };
}
