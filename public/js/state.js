// The single source of truth: the player's profile plus this sitting's streak.
// Everything the server stores lives on `profile`; everything transient lives on `session`.

import * as api from './api.js';
import { levelId, blankLevelRecord, cellKey, DEFAULT_OP } from './levels.js';

export const session = {
  streak: 0,          // consecutive correct answers with no mistake
  op: DEFAULT_OP,
  muted: localStorage.getItem('ms-muted') === '1',
};

let profile = null;
let saveTimer = null;
let saveQueued = false;

export const getProfile = () => profile;

export async function loadProfile(name) {
  profile = await api.getPlayer(name);
  profile.levels ||= {};
  // A streak belongs to the player who earned it. Without this, handing the iPad to
  // the next kid hands them the streak too -- and lets them take the record for it.
  session.streak = 0;
  localStorage.setItem('ms-last-player', profile.name);
  return profile;
}

export const lastPlayerName = () => localStorage.getItem('ms-last-player') || '';

/**
 * Get (creating if needed) the saved record for any puzzle, keyed by a free-form id.
 * The addition grids use "add-4"; the crossword and sudoku screens use their own ids.
 * One shelf for every game means one save path and one place progress can be lost.
 */
export function puzzleRecord(id) {
  profile.levels[id] ||= blankLevelRecord();
  profile.levels[id].tries ||= {};   // profiles saved before tries were tracked
  return profile.levels[id];
}

/** Get (creating if needed) the saved record for one level. */
export function levelRecord(op, size) {
  return puzzleRecord(levelId(op, size));
}

/** Wrong guesses already spent on one square, across every visit to this grid. */
export function triesOn(op, size, r, c) {
  return levelRecord(op, size).tries[cellKey(r, c)] || 0;
}

// Debounced save: a fast streak of answers becomes one request, not twenty.
export function save() {
  saveQueued = true;
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    saveQueued = false;
    try { await api.putPlayer(profile); }
    catch (err) { console.warn('[save] failed, will retry on next answer:', err.message); }
  }, 300);
}

/** Flush immediately -- used before leaving a level, so nothing is lost on a reload. */
export async function saveNow() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  saveQueued = false;
  try { await api.putPlayer(profile); } catch { /* offline: keep playing */ }
}

// ---------------------------------------------------------------- scoring

export function pointsFor(firstTry, streak) {
  return firstTry ? 10 + Math.min(streak, 10) * 2 : 5;
}

/**
 * Record a correct answer. `firstTry` is false if this cell was ever missed.
 * Returns the points awarded so the UI can float them.
 */
export function recordCorrect(op, size, r, c, firstTry) {
  const rec = levelRecord(op, size);
  rec.filled[cellKey(r, c)] = firstTry;

  const points = pointsFor(firstTry, session.streak);
  session.streak += 1;
  profile.totalCorrect += 1;
  profile.totalScore += points;
  if (session.streak > profile.bestStreak) profile.bestStreak = session.streak;

  save();
  return points;
}

/**
 * A wrong guess on one square. `usedTries` is the running total for that square, and
 * it is stored on the level rather than in the screen -- otherwise backing out to the
 * menu would refund the five tries and wash the miss off the record.
 */
export function recordMiss(op, size, r, c, usedTries) {
  const rec = levelRecord(op, size);
  rec.tries[cellKey(r, c)] = usedTries;
  rec.mistakes += 1;
  rec.perfect = false;
  session.streak = 0;
  profile.totalWrong += 1;
  save();
}

/** Called when every cell is filled. Returns the bonus breakdown for the banner. */
export function completeLevel(op, size, elapsedMs, runScore) {
  const rec = levelRecord(op, size);
  const cells = size * size;
  const completionBonus = cells * 5;
  // Perfect means every cell was answered on the first try -- which is exactly
  // what `filled` records, so it survives a stop-and-resume across days.
  const answers = Object.values(rec.filled);
  const perfect = answers.length === cells && answers.every(Boolean);
  const perfectBonus = perfect ? cells * 10 : 0;

  profile.totalScore += completionBonus + perfectBonus;

  const total = runScore + completionBonus + perfectBonus;
  rec.completed = true;
  rec.perfect = perfect;
  if (total > rec.bestScore) rec.bestScore = total;
  if (elapsedMs > 0 && (rec.bestTimeMs === 0 || elapsedMs < rec.bestTimeMs)) rec.bestTimeMs = elapsedMs;

  save();
  return { completionBonus, perfectBonus, perfect, total };
}

/** Wipe a level's saved progress so it can be replayed from scratch. */
export function resetLevelRun(op, size) {
  const rec = levelRecord(op, size);
  rec.filled = {};
  rec.tries = {};
  rec.mistakes = 0;
  rec.perfect = true;
  save();
  return rec;
}

export function setMuted(muted) {
  session.muted = muted;
  localStorage.setItem('ms-muted', muted ? '1' : '0');
}

// ---------------------------------------------------------------- other games
//
// The crossword and the sudoku score the same way the grids do -- points for a right
// answer, more of them on a streak -- but their cells are not (row, op, column), so
// they address the same records with a plain string key instead.

/** A right answer in a puzzle that is not an addition grid. Returns points awarded. */
export function recordPuzzleCorrect(id, key, firstTry) {
  const rec = puzzleRecord(id);
  rec.filled[key] = firstTry;

  const points = pointsFor(firstTry, session.streak);
  session.streak += 1;
  profile.totalCorrect += 1;
  profile.totalScore += points;
  if (session.streak > profile.bestStreak) profile.bestStreak = session.streak;

  save();
  return points;
}

/** A wrong guess in one of those puzzles. `usedTries` is that cell's running total. */
export function recordPuzzleMiss(id, key, usedTries) {
  const rec = puzzleRecord(id);
  rec.tries[key] = usedTries;
  rec.mistakes += 1;
  rec.perfect = false;
  session.streak = 0;
  profile.totalWrong += 1;
  save();
}

/** Wrong guesses already spent on one cell, across every visit to this puzzle. */
export function puzzleTriesOn(id, key) {
  return puzzleRecord(id).tries[key] || 0;
}

/** Every cell filled. `cells` is how many there were, for the completion bonus. */
export function completePuzzle(id, cells, elapsedMs, runScore) {
  const rec = puzzleRecord(id);
  const completionBonus = cells * 5;
  const answers = Object.values(rec.filled);
  const perfect = answers.length === cells && answers.every(Boolean);
  const perfectBonus = perfect ? cells * 10 : 0;

  profile.totalScore += completionBonus + perfectBonus;

  const total = runScore + completionBonus + perfectBonus;
  rec.completed = true;
  rec.perfect = perfect;
  if (total > rec.bestScore) rec.bestScore = total;
  if (elapsedMs > 0 && (rec.bestTimeMs === 0 || elapsedMs < rec.bestTimeMs)) rec.bestTimeMs = elapsedMs;

  save();
  return { completionBonus, perfectBonus, perfect, total };
}

/** Wipe a puzzle's saved progress so it can be played again from scratch. */
export function resetPuzzle(id) {
  const rec = puzzleRecord(id);
  rec.filled = {};
  rec.tries = {};
  rec.mistakes = 0;
  rec.perfect = true;
  save();
  return rec;
}
