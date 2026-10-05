// Sudoku, generated in the browser. No puzzle bank to ship and no two sittings alike.
//
// Boards are N x N with boxes of boxW x boxH (4x4 -> 2x2 boxes, 6x6 -> 3x2, 9x9 -> 3x3).
// Cells hold 1..N; 0 means empty. Everything is a flat array of length N*N, which is
// what both the solver and the screen want.

/** Mulberry32: a tiny seeded PRNG, so a saved puzzle regenerates exactly. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(list, rand) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function shapeFor(n) {
  if (n === 4) return { boxW: 2, boxH: 2 };
  if (n === 6) return { boxW: 3, boxH: 2 };
  return { boxW: 3, boxH: 3 };
}

function legal(board, n, boxW, boxH, index, value) {
  const row = Math.floor(index / n);
  const col = index % n;
  for (let i = 0; i < n; i++) {
    if (board[row * n + i] === value && i !== col) return false;
    if (board[i * n + col] === value && i !== row) return false;
  }
  const r0 = Math.floor(row / boxH) * boxH;
  const c0 = Math.floor(col / boxW) * boxW;
  for (let r = r0; r < r0 + boxH; r++) {
    for (let c = c0; c < c0 + boxW; c++) {
      if ((r !== row || c !== col) && board[r * n + c] === value) return false;
    }
  }
  return true;
}

/** A complete, valid board, filled by randomised backtracking. */
function solvedBoard(n, boxW, boxH, rand) {
  const board = new Array(n * n).fill(0);
  const values = Array.from({ length: n }, (_, i) => i + 1);

  const fill = (index) => {
    if (index === board.length) return true;
    for (const value of shuffled(values, rand)) {
      if (!legal(board, n, boxW, boxH, index, value)) continue;
      board[index] = value;
      if (fill(index + 1)) return true;
      board[index] = 0;
    }
    return false;
  };

  fill(0);
  return board;
}

/**
 * How many ways this board can be finished, counting no further than `cap`.
 * We only ever ask "is it more than one?", so stopping at two keeps digging fast.
 */
function countSolutions(board, n, boxW, boxH, cap = 2) {
  const work = board.slice();
  let found = 0;

  const step = () => {
    // Fewest candidates first: on a 9x9 this is the difference between instant
    // and "why has the iPad frozen".
    let best = -1;
    let bestOptions = null;
    for (let i = 0; i < work.length; i++) {
      if (work[i] !== 0) continue;
      const options = [];
      for (let v = 1; v <= n; v++) if (legal(work, n, boxW, boxH, i, v)) options.push(v);
      if (options.length === 0) return false;
      if (bestOptions === null || options.length < bestOptions.length) {
        best = i;
        bestOptions = options;
        if (options.length === 1) break;
      }
    }
    if (best === -1) { found += 1; return found >= cap; }

    for (const v of bestOptions) {
      work[best] = v;
      if (step()) { work[best] = 0; return true; }
      work[best] = 0;
    }
    return false;
  };

  step();
  return found;
}

/**
 * A puzzle with exactly one solution.
 *
 * `clues` is how many numbers to leave showing. Digging stops early if every
 * remaining cell is load-bearing, so the count is a target and not a promise --
 * which is fine: an easier board than asked for never hurt anybody.
 */
export function makeSudoku({ n = 4, clues, seed = Date.now() } = {}) {
  const { boxW, boxH } = shapeFor(n);
  const rand = rng(seed);
  const solution = solvedBoard(n, boxW, boxH, rand);
  const given = solution.slice();

  let remaining = n * n;
  for (const index of shuffled(solution.map((_, i) => i), rand)) {
    if (remaining <= clues) break;
    const saved = given[index];
    given[index] = 0;
    if (countSolutions(given, n, boxW, boxH) === 1) remaining -= 1;
    else given[index] = saved;    // that one was holding the puzzle together
  }

  return { n, boxW, boxH, seed, given, solution };
}
