// Pixelized fireworks: the payoff for filling the whole grid.
//
// The trick that makes this read as 1983 rather than 2026: simulate and render at
// ~192x144, then blit that tiny canvas up to full screen with smoothing OFF. Every
// particle lands on a chunky pixel grid instead of an anti-aliased dot.

import { sfx } from './audio.js';

const LOW_W = 192;
const LOW_H = 144;

// Hot to cold, the way a real shell burns out.
const RAMPS = [
  ['#ffffff', '#fff6a0', '#ffd400', '#ff8c1a', '#ff2f2f', '#5a0d0d'],
  ['#ffffff', '#c8f7ff', '#00e5ff', '#0090ff', '#3a2fff', '#100a4a'],
  ['#ffffff', '#ffd6ff', '#ff2fd0', '#c414a8', '#6a0a58', '#22001c'],
  ['#ffffff', '#d6ffe0', '#3dff8b', '#12c45c', '#0a6b33', '#02220f'],
];

const rand = (lo, hi) => lo + Math.random() * (hi - lo);

/**
 * Run a fireworks show over the whole viewport.
 * Returns a stop() function; also stops itself when the last ember dies.
 */
export function runFireworks(canvas, { shells = 8, spread = 5200, onDone } = {}) {
  const low = document.createElement('canvas');
  low.width = LOW_W;
  low.height = LOW_H;
  const lg = low.getContext('2d');

  const g = canvas.getContext('2d');
  const fit = () => {
    canvas.width = Math.round(window.innerWidth / 4) * 4;
    canvas.height = Math.round(window.innerHeight / 4) * 4;
    g.imageSmoothingEnabled = false;
  };
  fit();
  window.addEventListener('resize', fit);

  const rockets = [];
  const sparks = [];
  let launched = 0;
  let alive = true;
  let raf = null;
  const started = performance.now();
  let nextLaunch = started;

  function launch() {
    const ramp = RAMPS[Math.floor(Math.random() * RAMPS.length)];
    rockets.push({
      x: rand(LOW_W * 0.15, LOW_W * 0.85),
      y: LOW_H,
      vx: rand(-0.25, 0.25),
      vy: rand(-2.6, -1.9),
      targetY: rand(LOW_H * 0.15, LOW_H * 0.5),
      ramp,
    });
    sfx.launch();
  }

  function burst(x, y, ramp) {
    const count = 55 + Math.floor(Math.random() * 25);
    const power = rand(0.9, 1.7);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + rand(-0.06, 0.06);
      const speed = power * rand(0.35, 1.0);
      sparks.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: rand(45, 95),
        ramp,
      });
    }
    sfx.firework(Math.floor(rand(0, 6)));
  }

  function step(now) {
    if (!alive) return;

    if (launched < shells && now >= nextLaunch) {
      launch();
      launched += 1;
      nextLaunch = now + (spread / shells) * rand(0.5, 1.4);
    }

    // Trails: fade the previous frame instead of clearing it.
    lg.fillStyle = 'rgba(4, 4, 12, 0.34)';
    lg.fillRect(0, 0, LOW_W, LOW_H);

    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.x += r.vx;
      r.y += r.vy;
      r.vy += 0.028;                       // gravity
      lg.fillStyle = r.ramp[1];
      lg.fillRect(Math.round(r.x), Math.round(r.y), 1, 2);
      if (r.vy >= 0 || r.y <= r.targetY) {
        burst(r.x, r.y, r.ramp);
        rockets.splice(i, 1);
      }
    }

    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.022;                       // gravity
      s.vx *= 0.982;                       // air drag
      s.vy *= 0.982;
      s.life += 1;
      if (s.life > s.maxLife || s.y > LOW_H + 4) { sparks.splice(i, 1); continue; }

      // Colour is a function of age: white-hot, then cooling down the ramp.
      const idx = Math.min(s.ramp.length - 1, Math.floor((s.life / s.maxLife) * s.ramp.length));
      lg.fillStyle = s.ramp[idx];
      lg.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
    }

    g.clearRect(0, 0, canvas.width, canvas.height);
    g.imageSmoothingEnabled = false;
    g.drawImage(low, 0, 0, canvas.width, canvas.height);

    if (launched >= shells && !rockets.length && !sparks.length) { stop(); return; }
    raf = requestAnimationFrame(step);
  }

  function stop() {
    if (!alive) return;
    alive = false;
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener('resize', fit);
    onDone?.();
  }

  raf = requestAnimationFrame(step);
  return stop;
}
