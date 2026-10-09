// A voice, for the one game where hearing the word is the whole point. The mute button
// silences it along with everything else.
//
// Lines are played from recordings when there is one (tools/record-voice.mjs makes
// them with a modern voice, so every device sounds the same). Anything not recorded
// falls back to the browser's own speech -- and since every device has a different set
// of voices, and the default is usually the oldest, most robotic one, we rank what is
// there and take the most natural-sounding.

import { session } from './state.js';
import { RECORDED } from './letters/recorded.js';

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

// Novelty and legacy voices that ship on Macs and iPads -- never the one to pick.
const NOVELTY = /albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|junior|ralph|fred|kathy|grandma|grandpa|rocko|shelley|flo\b|eddy|reed|sandy/i;

// Voices that sound current, by family. Apple's premium/enhanced downloads, Microsoft's
// "Natural" neural voices in Edge, and Google's voices in Chrome.
const MODERN_NAMES = /\b(ava|zoe|evan|nathan|joelle|noelle|allison|susan|tom|aria|jenny|guy|ana|michelle|emma|brian|andrew)\b/i;

function score(voice) {
  const name = voice.name;
  if (NOVELTY.test(name)) return -1;
  let s = 0;
  if (/premium/i.test(name)) s += 60;
  if (/natural|neural/i.test(name)) s += 55;
  if (/enhanced/i.test(name)) s += 45;
  if (/^google/i.test(name)) s += 35;
  if (MODERN_NAMES.test(name)) s += 15;
  if (voice.lang === 'en-US' || voice.lang === 'en_US') s += 8;
  else if (/^en/i.test(voice.lang)) s += 3;
  else return -1;                     // not English at all
  return s;
}

let chosen;   // undefined until the device has told us its voices

function pickVoice() {
  if (chosen !== undefined) return chosen;
  const voices = synth?.getVoices() || [];
  if (!voices.length) return null;    // still loading; ask again next time
  chosen = voices
    .map((voice) => ({ voice, s: score(voice) }))
    .filter((v) => v.s >= 0)
    .sort((a, b) => b.s - a.s)[0]?.voice || null;
  return chosen;
}

// Chrome and Safari load their voice lists after the page does.
synth?.addEventListener?.('voiceschanged', () => { chosen = undefined; pickVoice(); });

let clipPlayer = null;   // the recording playing now, so the next line can cut it off

/**
 * Say something, cutting off anything still being said. `clip` names a recording of
 * the same line; if it was recorded, that plays instead of the device voice.
 */
export function say(text, clip) {
  if (session.muted) return;
  hush();
  if (clip && RECORDED.has(clip)) {
    clipPlayer = new Audio(`audio/letters/${clip}.mp4`);
    // A recording that will not play (a missing file, an odd browser) still gets said.
    clipPlayer.play().catch(() => speak(text));
    return;
  }
  speak(text);
}

function speak(text) {
  if (!synth) return;
  const line = new SpeechSynthesisUtterance(text);
  line.lang = 'en-US';
  line.rate = 0.9;       // a touch slow, for small ears -- any slower starts to drag
  line.pitch = 1;        // raising it is what makes these voices sound like robots
  const voice = pickVoice();
  if (voice) line.voice = voice;
  synth.speak(line);
}

/** Which voice the game ended up with, for anyone wondering why it sounds the way it does. */
export const voiceName = () => pickVoice()?.name || 'browser default';

export function hush() {
  clipPlayer?.pause();
  clipPlayer = null;
  synth?.cancel();
}
