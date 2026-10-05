// The little guy who dances when you get one right.
// Hand-drawn pixel data + canvas transforms -- no image files, no sprite sheet.
// Swap the strings below to swap the character; nothing else needs to change.

const PALETTE = {
  O: '#d97757',  // Claude orange, the body
  W: '#ffffff',  // eye white
  K: '#2a1810',  // pupil
  M: '#7a3a28',  // mouth
  '.': null,     // transparent
};

// A starburst with a face: a round body with eight solid spokes. 20x20.
const FACES = {
  normal: [
    '.........OO.........',
    '.........OO.........',
    '...O.....OO.....O...',
    '..OOO....OO....OOO..',
    '...OOO...OO...OOO...',
    '....OOOOOOOOOOOO....',
    '.....OOOOOOOOOO.....',
    '.....OOOOOOOOOO.....',
    '.....OWWWOOWWWO.....',
    'OOOOOOWKWOOWKWOOOOOO',
    'OOOOOOWKWOOWKWOOOOOO',
    '.....OOOOOOOOOO.....',
    '.....OOOOOOOOOO.....',
    '.....OOOMMMMOOO.....',
    '....OOOOOOOOOOOO....',
    '...OOO...OO...OOO...',
    '..OOO....OO....OOO..',
    '...O.....OO.....O...',
    '.........OO.........',
    '.........OO.........',
  ],
  happy: [
    '.........OO.........',
    '.........OO.........',
    '...O.....OO.....O...',
    '..OOO....OO....OOO..',
    '...OOO...OO...OOO...',
    '....OOOOOOOOOOOO....',
    '.....OOOOOOOOOO.....',
    '.....OOOOOOOOOO.....',
    '.....OOOOOOOOOO.....',
    'OOOOOOKKKOOKKKOOOOOO',
    'OOOOOOKOKOOKOKOOOOOO',
    '.....OOOOOOOOOO.....',
    '.....OOMMMMMMOO.....',
    '.....OOMMMMMMOO.....',
    '....OOOOMMMMOOOO....',
    '...OOO...OO...OOO...',
    '..OOO....OO....OOO..',
    '...O.....OO.....O...',
    '.........OO.........',
    '.........OO.........',
  ],
  sad: [
    '.........OO.........',
    '.........OO.........',
    '...O.....OO.....O...',
    '..OOO....OO....OOO..',
    '...OOO...OO...OOO...',
    '....OOOOOOOOOOOO....',
    '.....OOOOOOOOOO.....',
    '.....OOOOOOOOOO.....',
    '.....OWWWOOWWWO.....',
    'OOOOOOKWWOOWWKOOOOOO',
    'OOOOOOKWWOOWWKOOOOOO',
    '.....OOOOOOOOOO.....',
    '.....OOOMMMMOOO.....',
    '.....OOMOOOOMOO.....',
    '....OOOOOOOOOOOO....',
    '...OOO...OO...OOO...',
    '..OOO....OO....OOO..',
    '...O.....OO.....O...',
    '.........OO.........',
    '.........OO.........',
  ],
};

// Every frame is square and the same size; take the size from the art itself.
const SPRITE_W = FACES.normal[0].length;

function bake(rows) {
  const c = document.createElement('canvas');
  c.width = SPRITE_W;
  c.height = SPRITE_W;
  const g = c.getContext('2d');
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = PALETTE[ch];
      if (!color) return;
      g.fillStyle = color;
      g.fillRect(x, y, 1, 1);
    });
  });
  return c;
}

const BAKED = Object.fromEntries(Object.entries(FACES).map(([k, v]) => [k, bake(v)]));

const DANCE_MS = 2000;
// The little routine for a right answer: hop, hop, spin, hop. Seconds into the dance.
const SPIN_FROM = 0.55, SPIN_TO = 1.15;
const SAD_MS = 900;

export function createDancer(canvas) {
  const SCALE = 4;   // 20x20 art -> an 80px sprite, scaled up by CSS
  const SIZE = SPRITE_W * SCALE;
  const PAD = 34;                       // room for the sprite to hop and spin without clipping
  canvas.width = SIZE + PAD * 2;
  canvas.height = SIZE + PAD * 2;

  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;

  let mode = 'idle';
  let modeStart = performance.now();
  let raf = null;
  let alive = true;

  function draw(now) {
    if (!alive) return;
    const t = (now - modeStart) / 1000;
    g.clearRect(0, 0, canvas.width, canvas.height);

    let face = 'normal';
    let bob = 0, rot = 0, sx = 1, sy = 1;

    if (mode === 'idle') {
      // A slow breath so he never looks frozen.
      bob = Math.sin(t * 2) * 2;
      sy = 1 + Math.sin(t * 2) * 0.03;
      sx = 2 - sy;
    } else if (mode === 'dance' || mode === 'celebrate') {
      face = 'happy';
      const beat = t * 7;
      bob = -Math.abs(Math.sin(beat)) * 12;             // hops off the floor
      rot = Math.sin(beat * 0.5) * 0.38;                // sways left and right
      sy = 1 + Math.abs(Math.sin(beat)) * 0.16;         // stretches at the top of a hop
      sx = 2 - sy;                                      // ...and squashes sideways
      if (mode === 'dance' && t > SPIN_FROM && t < SPIN_TO) {
        // One full twirl, easing in and out so it reads as a spin, not a glitch.
        const k = (t - SPIN_FROM) / (SPIN_TO - SPIN_FROM);
        rot = (1 - Math.cos(k * Math.PI)) * Math.PI;
        bob = -Math.sin(k * Math.PI) * 10;              // ...up in the air while he spins
      }
      if (mode === 'dance' && now - modeStart > DANCE_MS) { mode = 'idle'; modeStart = now; }
    } else if (mode === 'sad') {
      face = 'sad';
      bob = 5;
      sy = 0.9;
      sx = 1.06;
      rot = Math.sin(t * 3) * 0.05;
      if (now - modeStart > SAD_MS) { mode = 'idle'; modeStart = now; }
    }

    g.save();
    g.translate(canvas.width / 2, canvas.height / 2 + bob);
    g.rotate(rot);
    g.scale(sx, sy);
    g.drawImage(BAKED[face], -SIZE / 2, -SIZE / 2, SIZE, SIZE);
    g.restore();

    raf = requestAnimationFrame(draw);
  }

  raf = requestAnimationFrame(draw);

  return {
    play(next) {
      // Never interrupt a celebration with a routine dance.
      if (mode === 'celebrate' && next === 'dance') return;
      mode = next;
      modeStart = performance.now();
      if (next === 'dance' || next === 'celebrate') {
        // A quick grow-and-settle so the eye is pulled over to him from the grid.
        canvas.animate(
          [{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }],
          { duration: 500, easing: 'ease-out' },
        );
      }
    },
    destroy() {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
    },
  };
}
