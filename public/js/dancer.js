// The little guy who dances when you get one right.
// Hand-drawn pixel data + canvas transforms -- no image files, no sprite sheet.
// Swap the strings below to swap the character; nothing else needs to change.
//
// He evolves: every finished puzzle moves him one stage on (see STAGES below), and the
// fireworks screen plays the change. The faces stay hand-drawn; the stages are layered
// on top in code, so fifteen forms don't mean forty-five sprites.

const PALETTE = {
  O: '#d97757',  // Claude orange, the body -- warms towards gold as he evolves
  W: '#ffffff',  // eye white
  K: '#2a1810',  // pupil
  M: '#7a3a28',  // mouth
  P: '#ff8fa3',  // cheeks
  G: '#ffe14d',  // gold spoke tips
  H: '#ffd2bd',  // shine on his head
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

// ---- evolution ---------------------------------------------------------

// Slow on purpose: one stage per finished puzzle, so it takes a good fifteen of them to
// see it all. Every stage grows him a little and warms his colour a little; most add
// one new thing as well, and 5, 10 and 15 add something big.
//
//   1 rosy cheeks      5 longer spokes     10 golden glow     15 rainbow halo
//   3 gold tips        7 shine on top      12 bigger gold tips
//   sparkles circling him: one at 6, then another at 8, 11 and 13
export const MAX_STAGE = 15;

const clampStage = (n) => Math.max(0, Math.min(MAX_STAGE, Math.floor(n || 0)));
const growth = (stage) => 1 + stage * 0.02;
const sparkleCount = (stage) => [6, 8, 11, 13].filter((at) => stage >= at).length;

const ORANGE = [0xd9, 0x77, 0x57];
const GOLDEN = [0xff, 0xb8, 0x3c];
const bodyColor = (stage) => '#' + ORANGE
  .map((v, i) => Math.round(v + (GOLDEN[i] - v) * (stage / MAX_STAGE)).toString(16).padStart(2, '0'))
  .join('');

// The faces are 20x20; evolved forms need room for longer spokes, so every form is
// drawn on a 24x24 sheet with the face in the middle.
const FACE_W = FACES.normal[0].length;
const OFF = 2;
const ART_W = FACE_W + OFF * 2;

// The eight spokes, in face coordinates [row, col]: the tip pixels, and the pixels each
// one grows outward at stage 5.
const SPOKES = [
  { tip: [[0, 9], [0, 10]],   grow: [[-1, 9], [-1, 10], [-2, 9], [-2, 10]] },
  { tip: [[19, 9], [19, 10]], grow: [[20, 9], [20, 10], [21, 9], [21, 10]] },
  { tip: [[9, 0], [10, 0]],   grow: [[9, -1], [10, -1], [9, -2], [10, -2]] },
  { tip: [[9, 19], [10, 19]], grow: [[9, 20], [10, 20], [9, 21], [10, 21]] },
  { tip: [[2, 3]],   grow: [[2, 2], [1, 2], [1, 1], [0, 1]] },
  { tip: [[2, 16]],  grow: [[2, 17], [1, 17], [1, 18], [0, 18]] },
  { tip: [[17, 3]],  grow: [[17, 2], [18, 2], [18, 1], [19, 1]] },
  { tip: [[17, 16]], grow: [[17, 17], [18, 17], [18, 18], [19, 18]] },
];

/** The pixel sheet for one face at one stage. */
function formRows(face, stage) {
  const sheet = Array.from({ length: ART_W }, () => Array(ART_W).fill('.'));
  FACES[face].forEach((row, y) => [...row].forEach((ch, x) => { sheet[y + OFF][x + OFF] = ch; }));
  const put = ([y, x], ch) => { sheet[y + OFF][x + OFF] = ch; };

  if (stage >= 1) [[11, 6], [11, 13]].forEach((p) => put(p, 'P'));
  if (stage >= 5) SPOKES.forEach((s) => s.grow.forEach((p) => put(p, 'O')));
  if (stage >= 3) {
    // The gold sits on the very end of each spoke; at 12 it runs one pixel further in.
    const reach = stage >= 12 ? 2 : 1;
    for (const s of SPOKES) {
      const line = stage >= 5 ? [...s.tip, ...s.grow] : s.tip;
      line.slice(-s.tip.length * reach).forEach((p) => put(p, 'G'));
    }
  }
  if (stage >= 7) [[6, 7], [6, 8], [7, 6]].forEach((p) => put(p, 'H'));
  return sheet;
}

const baked = new Map();

/** Draw a form once and keep it. `white` is the glowing outline used mid-evolution. */
function bake(face, stage, white) {
  const key = `${face}|${stage}|${white}`;
  if (baked.has(key)) return baked.get(key);
  const c = document.createElement('canvas');
  c.width = ART_W;
  c.height = ART_W;
  const g = c.getContext('2d');
  const colors = { ...PALETTE, O: bodyColor(stage) };
  formRows(face, stage).forEach((row, y) => row.forEach((ch, x) => {
    if (!colors[ch]) return;
    g.fillStyle = white ? '#ffffff' : colors[ch];
    g.fillRect(x, y, 1, 1);
  }));
  baked.set(key, c);
  return c;
}

const HALO = ['#ff4d5e', '#ff9a3c', '#ffe14d', '#3dff8b', '#3dd6ff', '#9a6bff'];

const DANCE_MS = 2000;
// The little routine for a right answer: hop, hop, spin, hop. Seconds into the dance.
const SPIN_FROM = 0.55, SPIN_TO = 1.15;
const SAD_MS = 900;

export function createDancer(canvas, { stage: startStage = 0 } = {}) {
  const SCALE = 4;   // one art pixel -> 4 canvas pixels, scaled up again by CSS
  // Big enough for the fully grown form to hop and spin with its sparkles, unclipped.
  canvas.width = 200;
  canvas.height = 200;

  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;

  let stage = clampStage(startStage);
  let white = false;
  let mode = 'idle';
  let modeStart = performance.now();
  let raf = null;
  let alive = true;
  let seen = false;   // a dancer whose canvas has left the page stops drawing by itself

  function draw(now) {
    if (!alive) return;
    if (canvas.isConnected) seen = true;
    else if (seen) { alive = false; return; }

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

    const size = ART_W * SCALE * growth(stage);
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const clock = now / 1000;

    if (!white && stage >= 15) drawHalo(cx, cy + bob, size, clock);

    g.save();
    g.translate(cx, cy + bob);
    g.rotate(rot);
    g.scale(sx, sy);
    if (white) {
      g.shadowColor = '#ffffff';
      g.shadowBlur = 22;
    } else if (stage >= 10) {
      g.shadowColor = 'rgba(255, 207, 64, 0.9)';
      g.shadowBlur = 14 + Math.sin(clock * 3) * 5;
    }
    g.drawImage(bake(face, stage, white), -size / 2, -size / 2, size, size);
    g.restore();

    if (!white) drawSparkles(cx, cy, size, clock);

    raf = requestAnimationFrame(draw);
  }

  function drawHalo(cx, cy, size, clock) {
    const r = size * 0.58;
    const n = 18;
    for (let i = 0; i < n; i++) {
      const a = clock * 0.8 + (i / n) * Math.PI * 2;
      g.fillStyle = HALO[i % HALO.length];
      g.fillRect(Math.round(cx + Math.cos(a) * r) - 3, Math.round(cy + Math.sin(a) * r) - 3, 6, 6);
    }
  }

  function drawSparkles(cx, cy, size, clock) {
    const n = sparkleCount(stage);
    const r = size * 0.62;
    for (let i = 0; i < n; i++) {
      const a = clock * 1.3 + (i / n) * Math.PI * 2;
      const x = Math.round(cx + Math.cos(a) * r);
      const y = Math.round(cy + Math.sin(a) * r * 0.8);
      const p = Math.sin(clock * 6 + i) > 0 ? 4 : 3;   // twinkle
      g.fillStyle = i % 2 ? '#ffffff' : '#ffe14d';
      g.fillRect(x - p / 2, y - p * 1.5, p, p * 3);     // a little plus sign
      g.fillRect(x - p * 1.5, y - p / 2, p * 3, p);
    }
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
    /** Change which form he is drawn as. `white` draws him as a glowing outline. */
    setLook(look) {
      if ('stage' in look) stage = clampStage(look.stage);
      if ('white' in look) white = Boolean(look.white);
    },
    destroy() {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
    },
  };
}
