// Chiptune sound effects synthesised in the browser. No audio files.
// Browsers require a user gesture before audio starts, so `unlock()` runs on PRESS START.

import { session } from './state.js';

let ctx = null;
let master = null;
let noiseBuffer = null;

/**
 * Browsers park the AudioContext whenever they feel like it -- backgrounding the tab,
 * an iOS phone call, a screen lock -- and nothing wakes it up on its own. So as well
 * as creating the context on the first gesture, we keep a net under it: any later tap
 * or key resumes it if it has drifted off. Without this the sound just quietly stops
 * partway through a session and never comes back.
 */
function keepAwake() {
  const resume = () => { if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); };
  for (const evt of ['pointerdown', 'keydown', 'touchend']) {
    window.addEventListener(evt, resume, true);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) resume(); });
}

export function unlock() {
  if (ctx) { if (ctx.state !== 'running') ctx.resume().catch(() => {}); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  keepAwake();
  master = ctx.createGain();
  master.gain.value = 0.28;          // arcade loud, not headache loud
  master.connect(ctx.destination);

  // One second of white noise, reused for every explosion and buzz.
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
}

const live = () => ctx && !session.muted;

/** One note with a click-free attack/release envelope. */
function tone(freq, duration, { type = 'square', gain = 0.5, at = 0, slideTo = null } = {}) {
  if (!live()) return;
  const t0 = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + duration);

  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  osc.connect(env).connect(master);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function noise(duration, { gain = 0.35, at = 0, freq = 1200, q = 1 } = {}) {
  if (!live()) return;
  const t0 = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(freq, t0);
  filter.frequency.exponentialRampToValueAtTime(Math.max(100, freq * 0.25), t0 + duration);
  filter.Q.value = q;
  const env = ctx.createGain();
  env.gain.setValueAtTime(gain, t0);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  src.connect(filter).connect(env).connect(master);
  src.start(t0);
  src.stop(t0 + duration + 0.02);
}

function melody(notes, { type = 'square', gain = 0.45, step = 0.09 } = {}) {
  notes.forEach(([freq, dur], i) => tone(freq, dur, { type, gain, at: i * step }));
}

// Equal-temperament note table, C4..C6, enough for cheerful arcade jingles.
const N = {
  C4: 261.63, E4: 329.63, G4: 392.00, A4: 440.00,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77,
  C6: 1046.50, E6: 1318.51, G6: 1567.98,
};

export const sfx = {
  navigate:  () => tone(N.E5, 0.06, { gain: 0.3 }),
  open:      () => tone(N.G5, 0.09, { type: 'square', gain: 0.35 }),
  close:     () => tone(N.C4, 0.09, { type: 'triangle', gain: 0.3 }),
  digit:     (d) => tone(400 + d * 45, 0.05, { type: 'square', gain: 0.22 }),
  back:      () => tone(300, 0.07, { type: 'triangle', gain: 0.3, slideTo: 180 }),

  correct:   () => melody([[N.C5, 0.1], [N.E5, 0.1], [N.G5, 0.1], [N.C6, 0.24]], { step: 0.065 }),
  wrong:     () => { tone(180, 0.22, { type: 'sawtooth', gain: 0.3, slideTo: 90 });
                     noise(0.16, { gain: 0.12, freq: 500 }); },

  start:     () => melody([[N.C5, 0.09], [N.G5, 0.09], [N.C6, 0.2]], { step: 0.075 }),

  // The hint picture appearing: a soft, friendly two-note chime.
  hint: () => melody([[N.E5, 0.12], [N.A5, 0.22]], { type: 'triangle', step: 0.09, gain: 0.3 }),

  // Out of tries on a square: the classic tumbling-down arcade sting.
  outOfTries: () => melody([[N.G5, 0.16], [N.E5, 0.16], [N.C5, 0.16], [N.A4, 0.4]],
                           { type: 'triangle', step: 0.15, gain: 0.42 }),
  // The whole grid clearing itself.
  wipe: () => { tone(420, 0.7, { type: 'sawtooth', gain: 0.3, slideTo: 70 });
                noise(0.6, { gain: 0.16, freq: 900 }); },
  unlockChime: () => melody([[N.G5, 0.1], [N.B5, 0.1], [N.E6, 0.3]], { type: 'triangle', step: 0.1 }),

  fanfare: () => {
    melody([[N.C5, 0.12], [N.C5, 0.12], [N.C5, 0.12], [N.C5, 0.26],
            [N.A4, 0.26], [N.B5, 0.26], [N.C6, 0.12], [N.C6, 0.5]],
           { step: 0.135, gain: 0.4 });
    // A low triangle-wave bass line under the fanfare.
    melody([[N.C4, 0.5], [N.G4, 0.5], [N.C5, 0.8]], { type: 'triangle', step: 0.4, gain: 0.25 });
  },

  firework: (i = 0) => {
    noise(0.5, { gain: 0.3, freq: 2600, q: 0.6, at: 0 });
    tone(1400 + i * 90, 0.06, { type: 'square', gain: 0.14 });
  },
  launch: () => tone(300, 0.35, { type: 'sine', gain: 0.12, slideTo: 1100 }),
};
