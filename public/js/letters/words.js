// The letters game: a picture, its name said out loud, and the letter it starts with.
//
// Letters come in the order phonics is usually taught (s a t p first), a few at a time.
// Every word starts with the plain sound of its letter -- no "ship", no "knife", no
// "giraffe" -- because the point is hearing the first sound and matching it. X has no
// word that starts with its sound, so it sits out.
//
// The picture is backed up by a voice saying the word, so "rabbit" vs "bunny" never
// matters: he hears which one it is.

export const WORDS = {
  S: [['sun', '☀️'], ['sock', '🧦'], ['snake', '🐍'], ['star', '⭐']],
  A: [['apple', '🍎'], ['ant', '🐜'], ['axe', '🪓']],
  T: [['tiger', '🐯'], ['tomato', '🍅'], ['tent', '⛺'], ['turtle', '🐢']],
  P: [['pig', '🐷'], ['pizza', '🍕'], ['penguin', '🐧'], ['pear', '🍐']],
  I: [['ice cream', '🍦'], ['island', '🏝️']],
  N: [['nose', '👃'], ['ninja', '🥷'], ['noodles', '🍜']],
  M: [['moon', '🌙'], ['monkey', '🐒'], ['mouse', '🐭'], ['mushroom', '🍄']],
  D: [['dog', '🐶'], ['duck', '🦆'], ['drum', '🥁'], ['door', '🚪']],
  G: [['goat', '🐐'], ['grapes', '🍇'], ['gift', '🎁'], ['guitar', '🎸']],
  O: [['octopus', '🐙'], ['orange', '🍊'], ['otter', '🦦']],
  C: [['cat', '🐱'], ['car', '🚗'], ['cow', '🐮'], ['cake', '🎂']],
  K: [['kite', '🪁'], ['key', '🔑'], ['kangaroo', '🦘'], ['koala', '🐨']],
  E: [['egg', '🥚'], ['elephant', '🐘'], ['elf', '🧝']],
  U: [['umbrella', '☂️'], ['unicorn', '🦄']],
  R: [['rabbit', '🐰'], ['rainbow', '🌈'], ['robot', '🤖'], ['rocket', '🚀']],
  H: [['hat', '🎩'], ['horse', '🐴'], ['house', '🏠'], ['heart', '❤️']],
  B: [['bear', '🐻'], ['banana', '🍌'], ['bee', '🐝'], ['bus', '🚌']],
  F: [['fish', '🐟'], ['frog', '🐸'], ['fox', '🦊'], ['fire', '🔥']],
  L: [['lion', '🦁'], ['leaf', '🍃'], ['lemon', '🍋'], ['lollipop', '🍭']],
  J: [['juice', '🧃'], ['jeans', '👖']],
  V: [['volcano', '🌋'], ['violin', '🎻'], ['van', '🚐']],
  W: [['watermelon', '🍉'], ['worm', '🪱'], ['wolf', '🐺'], ['watch', '⌚']],
  Y: [['yo-yo', '🪀'], ['yarn', '🧶']],
  Z: [['zebra', '🦓'], ['zombie', '🧟']],
  Q: [['queen', '👸']],
};

// What the voice calls each letter. Left to itself a speech engine reads "A" as the
// word "a" ("uh"), which is exactly the wrong lesson.
export const LETTER_NAMES = {
  A: 'ay', B: 'bee', C: 'see', D: 'dee', E: 'ee', F: 'eff', G: 'jee', H: 'aitch',
  I: 'eye', J: 'jay', K: 'kay', L: 'ell', M: 'em', N: 'en', O: 'oh', P: 'pee', Q: 'cue',
  R: 'are', S: 'ess', T: 'tee', U: 'you', V: 'vee', W: 'double you', Y: 'why', Z: 'zee',
};

// C and K make the same sound at the front of a word, so offering K for "cat" would be
// marking him wrong for hearing correctly. Neither is ever the other's wrong answer.
const SOUNDS_ALIKE = { C: ['K', 'Q'], K: ['C', 'Q'], Q: ['C', 'K'] };

/** The levels: each brings in a few new letters; the last one mixes the lot. */
export const LETTER_LEVELS = [
  { id: 'l1', letters: ['S', 'A', 'T', 'P'], choices: 2, rounds: 8 },
  { id: 'l2', letters: ['I', 'N', 'M', 'D'], choices: 3, rounds: 8 },
  { id: 'l3', letters: ['G', 'O', 'C', 'E'], choices: 3, rounds: 8 },
  { id: 'l4', letters: ['K', 'U', 'R', 'H'], choices: 4, rounds: 8 },
  { id: 'l5', letters: ['B', 'F', 'L', 'J'], choices: 4, rounds: 8 },
  { id: 'l6', letters: ['V', 'W', 'Y', 'Z', 'Q'], choices: 4, rounds: 8 },
  { id: 'l7', letters: Object.keys(WORDS), choices: 4, rounds: 10 },
];

// Names for the recorded clips of each line (see tools/record-voice.mjs).
const slug = (text) => text.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
export const wordClip = (word) => slug(word);
export const letterClip = (letter, word) => `${letter.toLowerCase()}-is-for-${slug(word)}`;

export const lettersById = (id) => LETTER_LEVELS.find((l) => l.id === id);
export const lettersRecordId = (id) => `letters-${id}`;

/** Every letter he has met by the end of this level. */
function knownLetters(level) {
  const upTo = LETTER_LEVELS.indexOf(level);
  return [...new Set(LETTER_LEVELS.slice(0, upTo + 1).flatMap((l) => l.letters))];
}

const shuffle = (list) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * A fresh run of pictures for a level, as words ("cat"). Each new letter gets its fair
 * share of turns, and the same picture never comes up twice in one go.
 */
export function makeRounds(level) {
  const perLetter = Math.ceil(level.rounds / level.letters.length);
  const picks = level.letters.flatMap((letter) => shuffle(WORDS[letter]).slice(0, perLetter));
  return shuffle(shuffle(picks).slice(0, level.rounds)).map(([word]) => word);
}

const byWord = new Map(Object.entries(WORDS).flatMap(([letter, words]) =>
  words.map(([word, picture]) => [word, { word, picture, letter }])));

/** Look a word back up: its picture and the letter it starts with. */
export const wordInfo = (word) => byWord.get(word);

/**
 * The letter buttons for one picture: the right one plus wrong ones, mostly from the
 * letters this level is teaching, never one that makes the same sound.
 */
export function makeChoices(level, letter) {
  const unfair = new Set([letter, ...(SOUNDS_ALIKE[letter] || [])]);
  const fresh = shuffle(level.letters.filter((l) => !unfair.has(l)));
  const older = shuffle(knownLetters(level).filter((l) => !unfair.has(l) && !fresh.includes(l)));
  return shuffle([letter, ...[...fresh, ...older].slice(0, level.choices - 1)]);
}

export function lettersUnlocked(profile, index) {
  if (index === 0) return true;
  if (profile?.levels?.[lettersRecordId(LETTER_LEVELS[index].id)]?.unlocked) return true;   // the code
  const prev = LETTER_LEVELS[index - 1];
  return Boolean(profile?.levels?.[lettersRecordId(prev.id)]?.completed);
}

/** The first level he has not finished -- where Enter should land. */
export function suggestedLetters(profile) {
  for (const [i, level] of LETTER_LEVELS.entries()) {
    if (!lettersUnlocked(profile, i)) break;
    if (!profile?.levels?.[lettersRecordId(level.id)]?.completed) return level.id;
  }
  return LETTER_LEVELS[LETTER_LEVELS.length - 1].id;
}
