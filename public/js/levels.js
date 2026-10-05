// Level definitions and the unlock rules.
// Operations are data, so switching to multiplication later is a one-line change.

export const OPS = {
  add: { id: 'add', symbol: '+', apply: (a, b) => a + b },
  mul: { id: 'mul', symbol: '×', apply: (a, b) => a * b },
  // Rows start above the biggest column, so every answer is at least 1.
  sub: { id: 'sub', symbol: '−', apply: (a, b) => a - b, rowOffset: (size) => size },
};

export const SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 10];
export const DEFAULT_OP = 'add';

export const levelId = (op, size) => `${op}-${size}`;
export const cellKey = (r, c) => `${r},${c}`;

/** The number on row r's label. 1..n, except subtraction, which counts n+1..2n. */
export const rowValue = (op, size, r) => r + 1 + (OPS[op].rowOffset?.(size) ?? 0);

/** The two operands for a cell: (row label) op (column label). */
export const operands = (op, size, r, c) => [rowValue(op, size, r), c + 1];

export function answerFor(op, size, r, c) {
  const [a, b] = operands(op, size, r, c);
  return OPS[op].apply(a, b);
}

/** The biggest answer on the board, so the keypad knows how many digits to take. */
export function maxAnswer(op, size) {
  return Math.max(answerFor(op, size, size - 1, size - 1), answerFor(op, size, size - 1, 0));
}

export function levelList(op = DEFAULT_OP) {
  return SIZES.map((size, index) => ({ index, size, op, id: levelId(op, size) }));
}

export function blankLevelRecord() {
  return {
    completed: false, perfect: true, bestScore: 0, bestTimeMs: 0,
    filled: {},   // "r,c" -> true if answered first try, false if it took retries
    tries: {},    // "r,c" -> wrong guesses burned on that square so far
    mistakes: 0,
  };
}

/** Level n unlocks when level n-1 is completed. The smallest grid is always open. */
export function isUnlocked(profile, op, size) {
  const i = SIZES.indexOf(size);
  if (i <= 0) return true;
  const prev = profile?.levels?.[levelId(op, SIZES[i - 1])];
  return Boolean(prev?.completed);
}

/** How far he has got: the first level that is unlocked but not finished. */
export function suggestedLevel(profile, op = DEFAULT_OP) {
  for (const size of SIZES) {
    if (!isUnlocked(profile, op, size)) break;
    if (!profile?.levels?.[levelId(op, size)]?.completed) return size;
  }
  return SIZES[SIZES.length - 1];
}
