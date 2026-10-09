// Records every line the letters game says, with one of the Mac's voices, into
// public/audio/letters/, and writes the list the game reads (public/js/letters/recorded.js).
//
//   node tools/record-voice.mjs                  # uses Ava (Premium)
//   node tools/record-voice.mjs "Zoe (Premium)"  # or any voice `say -v '?'` lists
//
// macOS only (it uses `say` and `afconvert`). Run it again after adding words; lines
// that are already recorded with the same voice are skipped.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORDS, wordClip, letterClip } from '../public/js/letters/words.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public/audio/letters');
const listFile = join(root, 'public/js/letters/recorded.js');
const voice = process.argv[2] || 'Ava (Premium)';
const RATE = '130';   // words a minute: under the default, for small ears (premium voices only slow a little)

const installed = execFileSync('say', ['-v', '?'], { encoding: 'utf8' });
if (!installed.split('\n').some((line) => line.startsWith(voice + ' '))) {
  console.error(`The voice "${voice}" is not installed. Download it in System Settings >`
    + ' Accessibility > Spoken Content > System voice > Manage Voices, then run this again.');
  process.exit(1);
}

// What the game can say: each word on its own, and "C is for cat".
const lines = Object.entries(WORDS).flatMap(([letter, words]) => words.flatMap(([word]) => [
  [wordClip(word), word],
  [letterClip(letter, word), `${letter} is for ${word}`],
]));

// A different voice means re-recording everything, not mixing two voices.
const previous = existsSync(listFile) ? readFileSync(listFile, 'utf8').match(/VOICE = (".*?"|null)/)?.[1] : null;
const sameVoice = previous === JSON.stringify(voice);

mkdirSync(outDir, { recursive: true });
const scratch = mkdtempSync(join(tmpdir(), 'record-voice-'));
let made = 0;

for (const [clip, text] of lines) {
  const target = join(outDir, `${clip}.mp4`);
  if (sameVoice && existsSync(target)) continue;
  const aiff = join(scratch, `${clip}.aiff`);
  execFileSync('say', ['-v', voice, '-r', RATE, '-o', aiff, text]);
  // AAC in an .mp4 plays in every browser the game runs in, at a fraction of the size.
  // (.mp4 rather than .m4a: claude.ai artifacts only serve the former.)
  execFileSync('afconvert', ['-f', 'mp4f', '-d', 'aac', '-b', '64000', aiff, target]);
  made += 1;
  if (made % 20 === 0) console.log(`${made} recorded...`);
}
rmSync(scratch, { recursive: true, force: true });

writeFileSync(listFile, `// Written by tools/record-voice.mjs -- do not edit by hand. Lists the voice clips in
// public/audio/letters/, so the game knows which lines it can play from a recording
// and which it has to hand to the device's own voice.

export const VOICE = ${JSON.stringify(voice)};
export const RECORDED = new Set(${JSON.stringify(lines.map(([clip]) => clip), null, 2)});
`);

console.log(`${lines.length} lines ready in public/audio/letters/ (${made} newly recorded with ${voice}).`);
