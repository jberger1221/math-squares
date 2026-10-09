// Level definitions: one grid per game, and the numbers on its labels.
// Operations are data, so switching to multiplication later is a one-line change.

export const TOP = 10;   // the biggest column number

export const OPS = {
  add: { id: 'add', symbol: '+', apply: (a, b) => a + b },
  mul: { id: 'mul', symbol: '×', apply: (a, b) => a * b },
  // Rows start above the biggest column, so every answer is at least 1.
  sub: { id: 'sub', symbol: '−', apply: (a, b) => a - b, rowOffset: TOP },
};

// There is one grid per game now: the 5x5 corner of the old 10x10, so he only drills
// the hard facts. Columns count 6..10; addition rows do too, subtraction rows 16..20.
export const SIZE = 5;
export const DEFAULT_OP = 'add';

// "-top" keeps these apart from the old "add-5" saves, which were for 1..5.
export const levelId = (op, size) => `${op}-top${size}`;
export const cellKey = (r, c) => `${r},${c}`;

/** The number on column c's label: the highest `size` numbers up to TOP. */
export const colValue = (size, c) => TOP - size + c + 1;

/** The number on row r's label. Same as the columns, except subtraction adds TOP. */
export const rowValue = (op, size, r) => colValue(size, r) + (OPS[op].rowOffset ?? 0);

/** The two operands for a cell: (row label) op (column label). */
export const operands = (op, size, r, c) => [rowValue(op, size, r), colValue(size, c)];

export function answerFor(op, size, r, c) {
  const [a, b] = operands(op, size, r, c);
  return OPS[op].apply(a, b);
}

/** The biggest answer on the board, so the keypad knows how many digits to take. */
export function maxAnswer(op, size) {
  return Math.max(answerFor(op, size, size - 1, size - 1), answerFor(op, size, size - 1, 0));
}

export function blankLevelRecord() {
  return {
    completed: false, perfect: true, bestScore: 0, bestTimeMs: 0,
    filled: {},   // "r,c" -> true if answered first try, false if it took retries
    tries: {},    // "r,c" -> wrong guesses burned on that square so far
    mistakes: 0,
  };
}
