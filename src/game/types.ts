/** A cell position as [row, col], zero-based from the top-left. */
export type Cell = readonly [row: number, col: number];

/** Cell key as used in puzzle JSON: "row,col". */
export type CellKey = `${number},${number}`;

/** The player's path: an ordered list of cells, starting on number 1. */
export type Path = readonly Cell[];

/** Puzzle as stored in src/puzzles/*.json. */
export interface Puzzle {
  id: string;
  size: number;
  /** "row,col" -> number (1..N). */
  numbers: Record<string, number>;
  /** Pairs of orthogonally adjacent cells with a wall between them. */
  walls?: ReadonlyArray<readonly [string, string]>;
  /** Optional known solution. Used for testing only, never for checking play. */
  solution?: ReadonlyArray<readonly [number, number]>;
}

/** What a single attempted step did to the path. */
export type StepKind =
  | 'extend' // added a new head cell
  | 'backtrack' // stepped back onto the previous cell (removed the head)
  | 'truncate' // cut the path back to an earlier cell
  | 'start' // began a new path on number 1
  | 'none' // no change (e.g. re-entering the current head)
  | 'invalid'; // move rejected

export interface StepResult {
  path: Path;
  kind: StepKind;
}
