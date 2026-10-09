// Five cabinets in one arcade. Each tile draws the game it leads to, so the choice
// can be made by a player who cannot read the name underneath it.

import { go } from '../router.js';
import { sfx } from '../audio.js';
import { getProfile, session, evolutionStage, setEvolutionStage } from '../state.js';
import { createSkipKey, chooseStage } from '../skipcode.js';

/** A number grid in miniature, with its sign over the top: + or −. */
const mathArt = (sign, accent) => () => {
  const art = document.createElement('div');
  art.className = 'game-art math-art';
  art.innerHTML = `<span class="math-art-sign ${accent}">${sign}</span>`;
  for (let i = 0; i < 9; i++) art.append(document.createElement('i'));
  return art;
};

/** A crossword corner: two blocks, two letters, one crossing. */
function crossArt() {
  const art = document.createElement('div');
  art.className = 'game-art cross-art';
  //  A B C
  //  B . .
  //  C . .   -- an L, the smallest shape that still reads as a crossword
  const plan = ['C', 'A', 'T', 'A', '', '', 'R', '', ''];
  for (const ch of plan) {
    const cell = document.createElement('i');
    if (ch) cell.textContent = ch;
    else cell.className = 'block';
    art.append(cell);
  }
  return art;
}

/** Four fruit, each once per row and column -- a two-by-two sudoku, already solved. */
function sudokuArt() {
  const art = document.createElement('div');
  art.className = 'game-art sudoku-art';
  for (const ch of ['🍎', '🍌', '🍌', '🍎']) {
    const cell = document.createElement('i');
    cell.textContent = ch;
    art.append(cell);
  }
  return art;
}

/** A picture and the letter it starts with: the whole letters game in two squares. */
function lettersArt() {
  const art = document.createElement('div');
  art.className = 'game-art letters-art';
  for (const [ch, cls] of [['🐍', 'pic'], ['S', 'neon-orange'], ['🐱', 'pic'], ['C', 'neon-orange']]) {
    const cell = document.createElement('i');
    cell.textContent = ch;
    cell.className = cls;
    art.append(cell);
  }
  return art;
}

const GAMES = [
  { screen: 'levelselect',     label: 'ADD',       art: mathArt('+', 'neon-pink'),   accent: 'neon',        op: 'add' },
  { screen: 'levelselect',     label: 'SUBTRACT',  art: mathArt('−', 'neon-yellow'), accent: 'neon-yellow', op: 'sub' },
  { screen: 'crosswordselect', label: 'CROSSWORD', art: crossArt,  accent: 'neon-pink' },
  { screen: 'sudokuselect',    label: 'SUDOKU',    art: sudokuArt, accent: 'neon-green' },
  { screen: 'lettersselect',   label: 'LETTERS',   art: lettersArt, accent: 'neon-orange' },
];

export function mount(el) {
  const profile = getProfile();

  const header = document.createElement('div');
  header.className = 'row';
  header.innerHTML = `
    <span class="title-md neon-yellow">${profile.name}</span>
    <span class="title-sm">SCORE ${profile.totalScore}</span>
    <span class="title-sm">BEST STREAK ${profile.bestStreak}</span>
  `;
  // The pickers each have a key for their locked levels; this one puts back a lost
  // dancer evolution, which belongs to the player rather than to any one game.
  header.append(createSkipKey({
    onUnlocked: () => chooseStage({ current: evolutionStage(), onPick: setEvolutionStage }),
  }));

  const heading = document.createElement('h2');
  heading.className = 'title-md neon';
  heading.textContent = 'PICK A GAME';

  const row = document.createElement('div');
  row.className = 'game-row';

  let first = null;
  for (const game of GAMES) {
    const tile = document.createElement('button');
    tile.className = 'game-tile';
    tile.setAttribute('aria-label', game.label);

    const label = document.createElement('span');
    label.className = `game-label ${game.accent}`;
    label.textContent = game.label;

    tile.append(game.art(), label);
    tile.addEventListener('click', () => {
      sfx.navigate();
      if (game.op) session.op = game.op;   // the grid screens read which table to play
      go(game.screen);
    });
    row.append(tile);
    first ||= tile;
  }

  const footer = document.createElement('div');
  footer.className = 'row';

  const scores = document.createElement('button');
  scores.className = 'chip';
  scores.textContent = '🏆 HIGH SCORES';
  scores.addEventListener('click', () => { sfx.navigate(); go('highscores'); });

  const swap = document.createElement('button');
  swap.className = 'chip';
  swap.textContent = '↺ CHANGE PLAYER';
  swap.addEventListener('click', () => { sfx.navigate(); go('nameentry'); });

  footer.append(scores, swap);
  el.append(header, heading, row, footer);
  first?.focus();
}
