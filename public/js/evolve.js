// The evolution on the fireworks screen: a big copy of the dancer as he was, then a
// flicker between his old and new outlines that speeds up, then the new form revealed.
// When he is already fully grown there is nothing to change, so he just celebrates.

import { sfx } from './audio.js';
import { createDancer } from './dancer.js';

const HOLD_MS = 1500;      // let the fanfare finish before anything changes
const FLICKER_MS = 3000;

/**
 * Build the scene. Returns its element (put it in the banner) and how long it runs,
 * so the banner can hold its buttons back until he has finished changing.
 */
export function playEvolution({ from, to }) {
  const canvas = document.createElement('canvas');
  canvas.className = 'dancer evolve';
  canvas.setAttribute('aria-hidden', 'true');
  const dancer = createDancer(canvas, { stage: from });

  if (to <= from) {
    dancer.play('celebrate');
    return { el: canvas, ms: 0 };
  }

  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const live = () => canvas.isConnected;
  dancer.play('idle');

  const reveal = () => {
    if (!live()) return;
    dancer.setLook({ stage: to, white: false });
    dancer.play('celebrate');
    sfx.evolved();
    canvas.animate(
      [{ filter: 'brightness(4)', transform: 'scale(1.4)' }, { filter: 'brightness(1)', transform: 'scale(1)' }],
      { duration: 700, easing: 'ease-out' },
    );
  };

  if (calm) {
    setTimeout(reveal, HOLD_MS + 600);
    return { el: canvas, ms: HOLD_MS + 600 };
  }

  // Old and new outlines take turns, faster and faster -- the bit everyone remembers.
  // Each swap is shape against shape, both white, so it never strobes the screen.
  setTimeout(() => {
    if (!live()) return;
    let showingNew = false;
    let wait = 420;
    let elapsed = 0;
    let tick = 0;
    dancer.setLook({ white: true });
    const step = () => {
      if (!live()) return;
      if (elapsed >= FLICKER_MS) return reveal();
      showingNew = !showingNew;
      dancer.setLook({ stage: showingNew ? to : from });
      sfx.evolveTick(tick++);
      elapsed += wait;
      wait = Math.max(110, wait * 0.85);
      setTimeout(step, wait);
    };
    step();
  }, HOLD_MS);

  return { el: canvas, ms: HOLD_MS + FLICKER_MS + 300 };
}
