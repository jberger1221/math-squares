// Level definitions, the numbers on their labels, and the unlock rules.
// Operations are data, so switching to multiplication later is a one-line change.

export const OPS = {
  add: { id: 'add', symbol: '+', apply: (a, b) => a + b },
  mul: { id: 'mul', symbol: '×', apply: (a, b) => a * b },
  // Rows start above the biggest column, so every answer is at least 1.
  sub: { id: 'sub', symbol: '−', apply: (a, b) => a - b, rowsAboveColumns: true },
};

// A level is named by the biggest number on it. Grids never grow past 5x5: from 5 up,
// a level is the 5x5 of its top five numbers -- level 7 is 3..7, level 10 is 6..10 --
// so the climb is to harder facts, not to more squares.
export const LEVELS = [2, 3, 4, 5, 6, 7, 8, 9, 10];
export const MAX_GRID = 5;
export const DEFAULT_OP = 'add';

export const gridSize = (level) => Math.min(level, MAX_GRID);

// Up to 5 the grids are the same as they always were, so they keep their old saves;
// the capped ones are new puzzles and get new ids.
export const levelId = (op, level) => (level <= MAX_GRID ? `${op}-${level}` : `${op}-${level}-top${MAX_GRID}`);
export const cellKey = (r, c) => `${r},${c}`;

/** The number on column c's label: the top `gridSize` numbers up to the level. */
export const colValue = (level, c) => level - gridSize(level) + c + 1;

/** The number on row r's label. Same as the columns, except subtraction adds the level. */
export const rowValue = (op, level, r) => colValue(level, r) + (OPS[op].rowsAboveColumns ? level : 0);

/** The two operands for a cell: (row label) op (column label). */
export const operands = (op, level, r, c) => [rowValue(op, level, r), colValue(level, c)];

export function answerFor(op, level, r, c) {
  const [a, b] = operands(op, level, r, c);
  return OPS[op].apply(a, b);
}

/** The biggest answer on the board, so the keypad knows how many digits to take. */
export function maxAnswer(op, level) {
  const last = gridSize(level) - 1;
  return Math.max(answerFor(op, level, last, last), answerFor(op, level, last, 0));
}

/** The numbers a level covers, low to high -- what its picker tile says. */
export const levelRange = (level) => [colValue(level, 0), level];

export function levelList(op = DEFAULT_OP) {
  return LEVELS.map((level, index) => ({ index, level, op, id: levelId(op, level) }));
}

export function blankLevelRecord() {
  return {
    completed: false, perfect: true, bestScore: 0, bestTimeMs: 0,
    filled: {},   // "r,c" -> true if answered first try, false if it took retries
    tries: {},    // "r,c" -> wrong guesses burned on that square so far
    mistakes: 0,
  };
}

/**
 * Level n unlocks when level n-1 is completed, or when a grown-up opened it with the
 * code. The smallest grid is always open.
 */
export function isUnlocked(profile, op, level) {
  const i = LEVELS.indexOf(level);
  if (i <= 0) return true;
  if (profile?.levels?.[levelId(op, level)]?.unlocked) return true;
  const prev = profile?.levels?.[levelId(op, LEVELS[i - 1])];
  return Boolean(prev?.completed);
}

/** How far he has got: the first level that is unlocked but not finished. */
export function suggestedLevel(profile, op = DEFAULT_OP) {
  for (const level of LEVELS) {
    if (!isUnlocked(profile, op, level)) break;
    if (!profile?.levels?.[levelId(op, level)]?.completed) return level;
  }
  return LEVELS[LEVELS.length - 1];
}
