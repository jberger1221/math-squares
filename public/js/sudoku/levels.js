// Sudoku levels. Fruit instead of digits on the small boards: a five-year-old can see
// "there is already an apple in this row" a long time before he can read a 4.
// The nine-wide board goes back to numbers -- nine fruit is nine things to tell apart,
// and by then he knows his digits from the addition grids anyway.

export const FRUIT4 = ['🍎', '🍌', '🍇', '🍓'];
export const FRUIT6 = ['🍎', '🍌', '🍇', '🍓', '🥕', '🌽'];
export const DIGITS9 = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export const SUDOKU_LEVELS = [
  { id: 's1', n: 4, clues: 9,  symbols: FRUIT4 },
  { id: 's2', n: 4, clues: 6,  symbols: FRUIT4 },
  { id: 's3', n: 6, clues: 20, symbols: FRUIT6 },
  { id: 's4', n: 6, clues: 15, symbols: FRUIT6 },
  { id: 's5', n: 9, clues: 40, symbols: DIGITS9 },
  { id: 's6', n: 9, clues: 32, symbols: DIGITS9 },
];

export const sudokuById = (id) => SUDOKU_LEVELS.find((l) => l.id === id);
export const sudokuRecordId = (id) => `sudoku-${id}`;

export function sudokuUnlocked(profile, index) {
  if (index === 0) return true;
  if (profile?.levels?.[sudokuRecordId(SUDOKU_LEVELS[index].id)]?.unlocked) return true;   // the code
  const prev = SUDOKU_LEVELS[index - 1];
  return Boolean(profile?.levels?.[sudokuRecordId(prev.id)]?.completed);
}

/** The first board he has not finished -- where Enter should land. */
export function suggestedSudoku(profile) {
  for (const [i, level] of SUDOKU_LEVELS.entries()) {
    if (!sudokuUnlocked(profile, i)) break;
    if (!profile?.levels?.[sudokuRecordId(level.id)]?.completed) return level.id;
  }
  return SUDOKU_LEVELS[SUDOKU_LEVELS.length - 1].id;
}
