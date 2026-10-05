// The hint panel: the sum drawn as things you can actually count.
//
//   addition       3 + 4   ->  [🍎🍎🍎] + [🍎🍎🍎🍎]
//   multiplication 4 × 3   ->  [🍎🍎🍎] [🍎🍎🍎] [🍎🍎🍎] [🍎🍎🍎]
//                              ...four groups of three, which is the whole point.
//   subtraction    7 − 3   ->  [🍎🍎🍎🍎❌❌❌]
//                              ...one pile, the last three crossed out. Count what's left.
//
// Every apple is the same apple. The boxes say which pile is which; making the fruit
// different colours as well just invites the question "why is that one green?".

const APPLE = [
  '....S.L..',
  '....SLL..',
  '..RRRRR..',
  '.RHRRRRR.',
  'RRHRRRRRR',
  'RRRRRRRRR',
  'RRRRRRRRR',
  '.RRRRRRR.',
  '..RRRRR..',
];

const SKIN = { R: '#ff4d5e', H: '#ff9aa4', S: '#6b3f1d', L: '#3dff8b' };

/** Draw the sprite once and keep it as a data URL we can repeat cheaply. */
function bake() {
  const c = document.createElement('canvas');
  c.width = APPLE[0].length;
  c.height = APPLE.length;
  const g = c.getContext('2d');
  APPLE.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = SKIN[ch];
      if (!color) return;
      g.fillStyle = color;
      g.fillRect(x, y, 1, 1);
    });
  });
  return c.toDataURL();
}

const SRC = bake();

function apple() {
  const img = document.createElement('img');
  img.className = 'apple';
  img.src = SRC;
  img.alt = '';
  return img;
}

function group(count, cls) {
  const box = document.createElement('div');
  box.className = `hint-group ${cls}`;
  for (let i = 0; i < count; i++) box.append(apple());
  return box;
}

/**
 * Build the picture for one equation.
 * `a` and `b` are the operands exactly as the equation shows them.
 */
export function createHint({ op, a, b }) {
  const panel = document.createElement('div');
  panel.className = 'hint';

  if (op === 'mul') {
    // a groups, each holding b apples. The boxes are the lesson.
    panel.classList.add('hint-mul');
    for (let i = 0; i < a; i++) panel.append(group(b, 'solo'));
    return panel;
  }

  if (op === 'sub') {
    // One pile of a; the last b are taken away, but stay visible so he can see where
    // they went. The answer is the apples that are still bright.
    const pile = group(a, 'a');
    [...pile.children].slice(a - b).forEach((img) => img.classList.add('gone'));
    panel.append(pile);
    return panel;
  }

  // Addition: two piles, told apart by the colour of the box around them.
  const plus = document.createElement('span');
  plus.className = 'hint-plus';
  plus.textContent = '+';
  panel.append(group(a, 'a'), plus, group(b, 'b'));
  return panel;
}
