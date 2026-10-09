# MATH SQUARES

An 80s-arcade puzzle cabinet, built for a five-year-old who cannot read yet.
Everything is numbers, pictures, colour, sound and animation — no words you need
to decode.

Three games share the cabinet, and after typing a name you pick one from **PICK A
GAME**: the addition grids, a picture crossword, and a fruit sudoku. Score, streak
and per-level progress are shared across all three.

## Start it

```bash
node server.js
```

Then open **http://localhost:8099**. The terminal also prints an address like
`http://192.168.1.42:8099` — type that into an iPad on the same wifi and it's the
same game, with the same player and the same progress.

Stop it with `Ctrl-C`.

## How to play: MATH

1. Tap anywhere on the title screen.
2. Tap your name, or spell it out on the big letter grid, then tap the green ✓.
3. Tap **ADD** or **SUBTRACT**. Each one is a single 5×5 grid of the hardest facts:
   addition is 6–10 + 6–10, subtraction is 16–20 − 6–10.
5. Tap any empty square you like — the empty ones pulse, and you can work through the
   grid in whatever order you feel like. It pops open showing something like
   `3 + 4 = ▮`. Tap the number pad (or type on the keyboard) and press the green ✓
   or Enter.
   - **Right:** the square gets a checkmark and the little guy dances. Then it waits
     for you to pick the next one.
   - **Wrong:** it shakes and buzzes and one of the five dots goes out. You get
     **five tries on each square**. Miss all five and the card shows you the right
     answer, then the whole grid empties and you start it over.
   - Tapping outside the card (or pressing Escape) closes it, but the dots you have
     already used stay used — closing is not a way to get your tries back.
6. Stuck? Press the yellow **?** for a picture you can count: `3 + 4` becomes three
   red apples next to four green ones, and `4 × 3` becomes four boxes with three
   apples in each. Apples sit five to a row, so ten is two neat rows rather than one
   long line. The picture appears on its own when you are down to your last try.
   Once you turn the picture on it stays on for the rest of the grid — press **?**
   again to put it away.
7. Fill every square and the fireworks go off — and the little guy **evolves**. He
   flickers between his old and new shapes and comes out a bit bigger and brighter.
   Every finished grid, crossword or sudoku moves him one step, and there are 15:
   rosy cheeks, gold tips, longer spokes, sparkles, a golden glow, and finally a
   rainbow halo. After that he just celebrates.

Gold squares were right on the first try; green ones took more than one go. A grid where
**every** square is gold earns a ★ PERFECT and a bonus.

## How to play: CROSSWORD

A crossword you solve without reading a word: every clue is a picture. You see a 🐱,
you spell `CAT`.

1. Pick a crossword. Locked ones keep their pictures hidden — finding out what is in
   the next one is most of the reason to finish this one.
2. Tap a picture in the list (or any square it belongs to). A card pops out with the
   picture big at the top and one box per letter.
3. Spell the word on the letter grid. The card checks itself as soon as the last box
   is full, so there is usually no need to reach for the ✓.
4. Letters that crossing words have already put on the grid arrive **filled in and
   gold** — those boxes are not yours to guess.

Wrong answers shake and buzz and put out one of four dots, and then:

- **After two misses** the card gives you one correct letter for free.
- **After four** it spells the whole word out, holds it there long enough to look at,
  and counts the word as answered.

There is no way to get stuck and no way to lose the puzzle. Press the yellow **?** at
any point to be handed a letter early.

Fill every word and the fireworks go off. Gold letters were solved with no help;
green ones took a hint or a retry.

## How to play: SUDOKU

Sudoku with fruit instead of digits, which is a game about noticing that this row has
no banana in it yet — no reading and no arithmetic required. The 9×9 boards go back
to digits.

1. Pick a board. They run 4×4, then 6×6, then 9×9, each in an easier and a harder cut.
2. Tap an empty square. Its row, column and box light up.
3. Tap the fruit that goes there. **Only the right one goes in** — anything else
   shakes red and stays out, so the board can never fill up with a mistake you then
   have to hunt for.
4. A fruit greys out in the tray once all of it is placed.

Stuck? The **💡** in the corner fills in the square you have chosen (or the next empty
one). It always works, so there is no such thing as a board he cannot finish.

Every board is generated fresh, with exactly one solution, and a half-finished one
comes back exactly as you left it.

## Lost progress? The 🔑

The crossword and sudoku pickers have a 🔑 next to the player's name. Tap it, enter
**6578**, and every locked tile turns into a 🔓 — tap one to jump straight into it. That
opens just that level (the ones after it still unlock the normal way) and hands out no
stars, score or evolution. The math games are a single grid, so there is nothing to unlock.

## Two kids, one cabinet

Progress is saved per player, so handing the iPad over is safe. From any puzzle, press
**←** to back out to **PICK A GAME** (from a crossword or sudoku, press it twice), then
**↺ CHANGE PLAYER**. Everything answered so
far is written to the server before you leave, and it's still there when that player
comes back — including which squares were solved, which were solved on the first try,
and how many tries have been burned on each square.

Streaks belong to the player who earned them, and do not carry across a switch.

## What gets saved

Scores live in `data/scores.json`, written by the server. That file is deliberately
untracked by git. Progress on a half-finished grid is saved too, so a session can be
stopped mid-grid and picked up later.

Two things are tracked per player:
- **Score** — points for correct answers, with a bonus for streaks and for perfect grids.
- **Longest streak** — the most answers in a row with no mistake.

## "My change isn't showing up"

The title screen prints a build stamp in the bottom-right corner, e.g. `BUILD 0823-1717`.
It is the newest edit time under `public/`, read fresh on every request. If the stamp
in the browser is older than the files on disk, the tab is stale — reload it.

This bites more than you'd expect: the server sends `Cache-Control: no-store`, but ES
modules are cached in the *page's* module map for the lifetime of that page. Leaving a
tab open across an edit means it keeps running the old code no matter what the server
sends. A plain reload fixes it (Cmd-R); Cmd-Shift-R if you want to be certain.

## Poking at it

No build step and no dependencies: it's plain ES modules served straight off disk.
Edit anything under `public/` and reload the page.

- `server.js` — static files plus a four-route JSON API
- `public/js/levels.js` — the grid size and which numbers go on the labels. `OPS` already contains
  multiplication; switching `session.op` to `'mul'` turns the whole game into a times table
- `public/js/crossword/puzzles.js` — the crosswords, written as finished grids plus a
  word→emoji table. Entries are *derived* from the grid, so a puzzle whose words do
  not all have pictures refuses to load rather than going out broken
- `public/js/sudoku/levels.js` — board sizes, difficulty and which fruit they use
- `public/js/sudoku/generate.js` — the generator, including the uniqueness check that
  keeps every dug-out board solvable exactly one way
- `public/js/dancer.js` — the character, drawn as text. Edit the strings to redraw him
- `public/js/audio.js` — every sound, synthesised in the browser
