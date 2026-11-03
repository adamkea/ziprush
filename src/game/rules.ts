import type { Cell, CellKey, Path, Puzzle, StepResult } from './types';

export const cellKey = (cell: Cell): CellKey => `${cell[0]},${cell[1]}`;

export const sameCell = (a: Cell, b: Cell): boolean => a[0] === b[0] && a[1] === b[1];

export const inBounds = (cell: Cell, puzzle: Puzzle): boolean =>
  Number.isInteger(cell[0]) &&
  Number.isInteger(cell[1]) &&
  cell[0] >= 0 &&
  cell[1] >= 0 &&
  cell[0] < puzzle.size &&
  cell[1] < puzzle.size;

/** True when a and b share an edge (no diagonals, not the same cell). */
export const isAdjacent = (a: Cell, b: Cell): boolean =>
  Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;

export const numberAt = (cell: Cell, puzzle: Puzzle): number | undefined =>
  puzzle.numbers[cellKey(cell)];

/** Highest number in the puzzle (N). */
export function maxNumber(puzzle: Puzzle): number {
  return Math.max(0, ...Object.values(puzzle.numbers));
}

// Walls are stored as an unordered pair key "a|b" with a < b, cached per puzzle object.
const wallCache = new WeakMap<Puzzle, Set<string>>();
const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function wallSet(puzzle: Puzzle): Set<string> {
  let set = wallCache.get(puzzle);
  if (!set) {
    set = new Set((puzzle.walls ?? []).map(([a, b]) => edgeKey(a, b)));
    wallCache.set(puzzle, set);
  }
  return set;
}

/** True when a wall sits on the edge between cells a and b. */
export function hasWall(a: Cell, b: Cell, puzzle: Puzzle): boolean {
  return wallSet(puzzle).has(edgeKey(cellKey(a), cellKey(b)));
}

/**
 * The next number the path must pass through, or null when every number has been
 * reached. Assumes the path was built with canExtend (numbers are in order).
 */
export function nextRequiredNumber(path: Path, puzzle: Puzzle): number | null {
  let reached = 0;
  for (const cell of path) {
    const n = numberAt(cell, puzzle);
    if (n !== undefined && n === reached + 1) reached = n;
  }
  return reached >= maxNumber(puzzle) ? null : reached + 1;
}

/** Index of cell within path, or -1. */
export function indexInPath(path: Path, cell: Cell): number {
  for (let i = 0; i < path.length; i++) if (sameCell(path[i]!, cell)) return i;
  return -1;
}

/** Can `cell` be appended to `path` as the new head? */
export function canExtend(path: Path, cell: Cell, puzzle: Puzzle): boolean {
  if (!inBounds(cell, puzzle)) return false;
  const n = numberAt(cell, puzzle);

  // An empty path may only start on number 1.
  if (path.length === 0) return n === 1;

  const head = path[path.length - 1]!;
  if (!isAdjacent(head, cell)) return false;
  if (hasWall(head, cell, puzzle)) return false;
  if (indexInPath(path, cell) !== -1) return false;

  // The path must end on N, so nothing can follow it.
  if (numberAt(head, puzzle) === maxNumber(puzzle)) return false;

  // Numbered cells may only be entered in ascending order.
  if (n !== undefined && n !== nextRequiredNumber(path, puzzle)) return false;
  return true;
}

/**
 * Full validation of a path against every rule, independent of how it was built.
 * Useful for checking stored solutions.
 */
export function isValidPath(path: Path, puzzle: Puzzle): boolean {
  let built: Path = [];
  for (const cell of path) {
    if (!canExtend(built, cell, puzzle)) return false;
    built = [...built, cell];
  }
  return true;
}

/** Solved = every cell visited once, numbers hit in order, ending on N. */
export function isSolved(path: Path, puzzle: Puzzle): boolean {
  if (path.length !== puzzle.size * puzzle.size) return false;
  if (!isValidPath(path, puzzle)) return false;
  const head = path[path.length - 1]!;
  return numberAt(head, puzzle) === maxNumber(puzzle) && nextRequiredNumber(path, puzzle) === null;
}

/**
 * Apply one pointer-drag step: the pointer has entered `cell`.
 * - On the path: truncate back to it (stepping onto the previous cell is a backtrack).
 * - Otherwise: extend if legal, else invalid.
 */
export function applyDragStep(path: Path, cell: Cell, puzzle: Puzzle): StepResult {
  const idx = indexInPath(path, cell);
  if (idx !== -1) {
    if (idx === path.length - 1) return { path, kind: 'none' };
    return {
      path: path.slice(0, idx + 1),
      kind: idx === path.length - 2 ? 'backtrack' : 'truncate',
    };
  }
  if (canExtend(path, cell, puzzle)) {
    return { path: [...path, cell], kind: path.length === 0 ? 'start' : 'extend' };
  }
  return { path, kind: 'invalid' };
}

/**
 * Apply one keyboard step. Stricter than dragging: only the previous cell backtracks,
 * other visited cells are rejected.
 */
export function applyKeyStep(path: Path, cell: Cell, puzzle: Puzzle): StepResult {
  if (path.length >= 2 && sameCell(path[path.length - 2]!, cell)) {
    return { path: path.slice(0, -1), kind: 'backtrack' };
  }
  if (canExtend(path, cell, puzzle)) {
    return { path: [...path, cell], kind: path.length === 0 ? 'start' : 'extend' };
  }
  return { path, kind: 'invalid' };
}

/** Where a press (pointer down / tap) on `cell` leaves the path. */
export function applyPress(path: Path, cell: Cell, puzzle: Puzzle): StepResult {
  const idx = indexInPath(path, cell);
  if (idx !== -1) {
    if (idx === path.length - 1) return { path, kind: 'none' };
    return { path: path.slice(0, idx + 1), kind: 'truncate' };
  }
  // Pressing number 1 always (re)starts the path.
  if (numberAt(cell, puzzle) === 1) return { path: [cell], kind: 'start' };
  return applyDragStep(path, cell, puzzle);
}

/** Locate the cell holding number 1. */
export function startCell(puzzle: Puzzle): Cell | null {
  for (const [key, n] of Object.entries(puzzle.numbers)) {
    if (n === 1) {
      const [r, c] = key.split(',').map(Number);
      return [r!, c!];
    }
  }
  return null;
}
