// Boot: register the screens, then raise the curtain.

import { register, go } from './router.js';
import * as title from './screens/title.js';
import * as nameentry from './screens/nameentry.js';
import * as gamepick from './screens/gamepick.js';
import * as levelselect from './screens/levelselect.js';
import * as game from './screens/game.js';
import * as crosswordselect from './screens/crosswordselect.js';
import * as crossword from './screens/crossword.js';
import * as sudokuselect from './screens/sudokuselect.js';
import * as sudoku from './screens/sudoku.js';
import * as highscores from './screens/highscores.js';

register('title', title);
register('nameentry', nameentry);
register('gamepick', gamepick);
register('levelselect', levelselect);
register('game', game);
register('crosswordselect', crosswordselect);
register('crossword', crossword);
register('sudokuselect', sudokuselect);
register('sudoku', sudoku);
register('highscores', highscores);

// iPad: stop a stray double-tap from zooming the cabinet.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

go('title');
