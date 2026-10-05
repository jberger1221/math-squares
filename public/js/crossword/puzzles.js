// PICTURE CROSSWORDS.
//
// A crossword normally asks you to read the clues, which rules it out for the player
// this cabinet was built for. So the clues here are pictures: you see a 🐱 and you
// spell CAT. That keeps the puzzle honest -- it is still a crossword, the letters
// still have to cross -- without a single word of instructions to decode.
//
// Each puzzle is written as the finished grid: letters are squares, '.' is a block.
// The entries are DERIVED from that in build.js, so a grid and its clue list can
// never drift apart -- every run of two or more letters must have a picture, or the
// puzzle refuses to load.

export const PICTURES = {
  CAT: '🐱', CAR: '🚗', SUN: '☀️', NUT: '🥜', HAT: '🎩', COW: '🐄',
  WEB: '🕸️', BEE: '🐝', STAR: '⭐', NEST: '🪺', RAT: '🐀', DUCK: '🦆',
  DOG: '🐶', GOAT: '🐐', KITE: '🪁', RAIN: '🌧️', CORN: '🌽',
};

// Ordered easiest first: two words, then three, then four, then five.
export const PUZZLES = [
  { id: 'x1', rows: ['CAT', 'A..', 'R..'] },
  { id: 'x2', rows: ['SUN', '..U', 'HAT'] },
  { id: 'x3', rows: ['CAT', 'O..', 'WEB', '..E', '..E'] },
  { id: 'x4', rows: ['SUN', 'T.E', 'A.S', 'RAT'] },
  { id: 'x5', rows: ['DUCK', 'O..I', 'GOAT', '...E'] },
  { id: 'x6', rows: ['STAR', '...A', '...I', 'CORN', 'O...', 'WEB.'] },
];

export const puzzleById = (id) => PUZZLES.find((p) => p.id === id);
