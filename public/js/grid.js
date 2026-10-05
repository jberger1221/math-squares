// The n x n table: label row, label column, and the answer cells.

import { OPS, cellKey, rowValue } from './levels.js';

/**
 * Build the grid DOM.
 * @returns {{el, cellAt, setSolved, setActive, size, forEachCell}}
 */
export function createGrid({ size, op, onCell }) {
  const wrap = document.createElement('div');
  wrap.className = 'grid-wrap';

  const grid = document.createElement('div');
  grid.className = 'grid';
  grid.style.gridTemplateColumns = `repeat(${size + 1}, minmax(0, 1fr))`;
  grid.style.gridTemplateRows = `repeat(${size + 1}, minmax(0, 1fr))`;

  const cells = new Map();       // "r,c" -> button   (answer cells only)
  const colLabels = [];
  const rowLabels = [];

  const makeCell = (cls, text) => {
    const b = document.createElement('button');
    b.className = `cell ${cls}`;
    const s = document.createElement('span');
    s.textContent = text;
    b.append(s);
    return b;
  };

  for (let row = 0; row <= size; row++) {
    for (let col = 0; col <= size; col++) {
      if (row === 0 && col === 0) {
        const corner = makeCell('label corner', OPS[op].symbol);
        corner.disabled = true;
        grid.append(corner);
      } else if (row === 0) {
        const b = makeCell('label', String(col));   // column headings: 1..n
        b.disabled = true;
        colLabels[col - 1] = b;
        grid.append(b);
      } else if (col === 0) {
        const b = makeCell('label', String(rowValue(op, size, row - 1)));   // row headings
        b.disabled = true;
        rowLabels[row - 1] = b;
        grid.append(b);
      } else {
        const r = row - 1;
        const c = col - 1;
        const b = makeCell('empty', '');
        b.dataset.r = r;
        b.dataset.c = c;
        // Screen readers and curious grown-ups get the words; the kid gets the picture.
        b.setAttribute('aria-label', `${rowValue(op, size, r)} ${OPS[op].symbol} ${col}`);
        // Highlighting the two labels shows WHERE the numbers come from.
        b.addEventListener('pointerenter', () => lightLabels(r, c, true));
        b.addEventListener('pointerleave', () => lightLabels(r, c, false));
        b.addEventListener('focus', () => lightLabels(r, c, true));
        b.addEventListener('blur', () => lightLabels(r, c, false));
        if (onCell) b.addEventListener('click', () => onCell(r, c, b));
        else b.disabled = true;          // the attract-mode demo is scenery, not a control
        cells.set(cellKey(r, c), b);
        grid.append(b);
      }
    }
  }

  function lightLabels(r, c, on) {
    rowLabels[r]?.classList.toggle('lit', on);
    colLabels[c]?.classList.toggle('lit', on);
  }

  wrap.append(grid);

  return {
    el: wrap,
    size,
    cellAt: (r, c) => cells.get(cellKey(r, c)),
    forEachCell: (fn) => cells.forEach((el, key) => {
      const [r, c] = key.split(',').map(Number);
      fn(el, r, c);
    }),

    /** Stamp a cell as answered. `perfect` = got it on the first try. */
    setSolved(r, c, value, perfect, animate = false) {
      const el = cells.get(cellKey(r, c));
      if (!el) return;
      el.classList.remove('empty', 'active', 'solved', 'solved-perfect', 'just-solved');
      el.classList.add(perfect ? 'solved-perfect' : 'solved');
      el.disabled = true;
      el.firstChild.textContent = String(value);
      if (animate) {
        el.classList.add('just-solved');
        el.addEventListener('animationend', () => el.classList.remove('just-solved'), { once: true });
      }
    },

    setActive(r, c, on) {
      cells.get(cellKey(r, c))?.classList.toggle('active', on);
    },

    /** Empty every square again (the attract-mode loop). */
    reset() {
      cells.forEach((el) => {
        el.className = 'cell empty';
        el.firstChild.textContent = '';
        el.disabled = !onCell;
      });
    },
  };
}
