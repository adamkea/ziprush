import { describe, expect, it } from 'vitest';
import {
  applyDragStep,
  applyKeyStep,
  applyPress,
  canExtend,
  hasWall,
  isAdjacent,
  isSolved,
  isValidPath,
  maxNumber,
  nextRequiredNumber,
  startCell,
} from './rules';
import type { Cell, Path, Puzzle } from './types';

/*
 * 3x3 test puzzle. Numbers: 1 at (0,0), 2 at (2,2), 3 at (2,0).
 * One wall, between (1,1) and (1,2):
 *
 *   1 . .
 *   . .|.
 *   3 . 2
 *
 * A valid solution: (0,0)(0,1)(0,2)(1,2)(2,2)=2 (2,1)(1,1)(1,0)(2,0)=3
 */
const P: Puzzle = {
  id: 't',
  size: 3,
  numbers: { '0,0': 1, '2,2': 2, '2,0': 3 },
  walls: [['1,1', '1,2']],
};
const SOLUTION: Cell[] = [
  [0, 0],
  [0, 1],
  [0, 2],
  [1, 2],
  [2, 2],
  [2, 1],
  [1, 1],
  [1, 0],
  [2, 0],
];

describe('isAdjacent', () => {
  it('accepts orthogonal neighbours only', () => {
    expect(isAdjacent([1, 1], [0, 1])).toBe(true);
    expect(isAdjacent([1, 1], [1, 2])).toBe(true);
    expect(isAdjacent([1, 1], [2, 2])).toBe(false); // diagonal
    expect(isAdjacent([1, 1], [1, 1])).toBe(false); // same
    expect(isAdjacent([0, 0], [0, 2])).toBe(false); // two away
  });
});

describe('hasWall', () => {
  it('detects walls in either direction', () => {
    expect(hasWall([1, 1], [1, 2], P)).toBe(true);
    expect(hasWall([1, 2], [1, 1], P)).toBe(true);
  });
  it('is false for open edges and puzzles without walls', () => {
    expect(hasWall([0, 0], [0, 1], P)).toBe(false);
    expect(hasWall([0, 0], [0, 1], { ...P, walls: undefined })).toBe(false);
  });
});

describe('nextRequiredNumber', () => {
  it('is 1 for an empty path', () => {
    expect(nextRequiredNumber([], P)).toBe(1);
  });
  it('advances as numbers are reached', () => {
    expect(nextRequiredNumber(SOLUTION.slice(0, 1), P)).toBe(2);
    expect(nextRequiredNumber(SOLUTION.slice(0, 4), P)).toBe(2);
    expect(nextRequiredNumber(SOLUTION.slice(0, 5), P)).toBe(3);
  });
  it('is null once N is reached', () => {
    expect(nextRequiredNumber(SOLUTION, P)).toBeNull();
  });
  it('maxNumber is N', () => {
    expect(maxNumber(P)).toBe(3);
  });
});

describe('canExtend', () => {
  it('only starts on number 1', () => {
    expect(canExtend([], [0, 0], P)).toBe(true);
    expect(canExtend([], [0, 1], P)).toBe(false);
    expect(canExtend([], [2, 2], P)).toBe(false);
  });

  it('allows orthogonal steps to unvisited cells', () => {
    expect(canExtend([[0, 0]], [0, 1], P)).toBe(true);
    expect(canExtend([[0, 0]], [1, 0], P)).toBe(true);
  });

  it('rejects diagonal and non-adjacent moves', () => {
    expect(canExtend([[0, 0]], [1, 1], P)).toBe(false);
    expect(canExtend([[0, 0]], [0, 2], P)).toBe(false);
  });

  it('rejects out-of-bounds cells', () => {
    expect(canExtend([[0, 0]], [-1, 0], P)).toBe(false);
    expect(canExtend([[0, 0]], [0, -1], P)).toBe(false);
    expect(canExtend([[0, 2]], [0, 3], P)).toBe(false);
  });

  it('rejects revisits', () => {
    const path: Path = [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 0],
    ];
    expect(canExtend(path, [0, 0], P)).toBe(false);
  });

  it('rejects crossing a wall', () => {
    const path: Path = [
      [0, 0],
      [0, 1],
      [1, 1],
    ];
    expect(canExtend(path, [1, 2], P)).toBe(false);
    expect(canExtend(path, [2, 1], P)).toBe(true);
  });

  it('rejects numbers out of order', () => {
    // From (1,0) the next cell (2,0) holds 3, but 2 has not been reached yet.
    const path: Path = [
      [0, 0],
      [1, 0],
    ];
    expect(canExtend(path, [2, 0], P)).toBe(false);
    // Re-entering 1 is impossible too (already visited), and 2 is fine when it is next.
    const toTwo: Path = [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 2],
    ];
    expect(canExtend(toTwo, [2, 2], P)).toBe(true);
  });

  it('allows unnumbered cells regardless of which number is next', () => {
    expect(canExtend(SOLUTION.slice(0, 5), [2, 1], P)).toBe(true);
  });

  it('never extends past N', () => {
    // Small puzzle where N is reachable early.
    const q: Puzzle = { id: 'q', size: 2, numbers: { '0,0': 1, '0,1': 2 } };
    expect(canExtend([[0, 0], [0, 1]], [1, 1], q)).toBe(false);
  });
});

describe('isValidPath / isSolved', () => {
  it('accepts a complete valid solution', () => {
    expect(isValidPath(SOLUTION, P)).toBe(true);
    expect(isSolved(SOLUTION, P)).toBe(true);
  });

  it('accepts any valid solution, not a stored one', () => {
    // 2x2 with only start/end numbers has two valid routes; both count.
    const q: Puzzle = { id: 'q', size: 2, numbers: { '0,0': 1, '1,0': 2 } };
    expect(isSolved([[0, 0], [0, 1], [1, 1], [1, 0]], q)).toBe(true);
    const r: Puzzle = { id: 'r', size: 2, numbers: { '0,0': 1, '1,1': 2 } };
    expect(isSolved([[0, 0], [0, 1], [1, 1]], r)).toBe(false); // incomplete
  });

  it('rejects incomplete paths', () => {
    expect(isSolved(SOLUTION.slice(0, -1), P)).toBe(false);
    expect(isSolved([], P)).toBe(false);
  });

  it('rejects paths that do not end on N', () => {
    // Every cell visited, numbers in order, but ends elsewhere: N=2 at (0,1).
    const q: Puzzle = { id: 'q', size: 2, numbers: { '0,0': 1, '0,1': 2 } };
    expect(isSolved([[0, 0], [1, 0], [1, 1], [0, 1]], q)).toBe(true);
    expect(isSolved([[0, 0], [0, 1], [1, 1], [1, 0]], q)).toBe(false);
  });

  it('rejects revisits, diagonals and walls in a full-length path', () => {
    const dup = [...SOLUTION.slice(0, -1), [0, 0] as Cell];
    expect(isSolved(dup, P)).toBe(false);
    const diag: Cell[] = [...SOLUTION];
    [diag[5], diag[6]] = [diag[6]!, diag[5]!]; // creates a diagonal jump
    expect(isValidPath(diag, P)).toBe(false);
    const walled: Puzzle = { ...P, walls: [['0,1', '0,2']] };
    expect(isSolved(SOLUTION, walled)).toBe(false);
  });

  it('rejects numbers taken out of order', () => {
    const swapped: Puzzle = { ...P, numbers: { '0,0': 1, '2,2': 3, '2,0': 2 } };
    expect(isSolved(SOLUTION, swapped)).toBe(false);
  });
});

describe('applyDragStep', () => {
  const path: Path = SOLUTION.slice(0, 4); // head at (1,2)

  it('extends to a legal neighbour', () => {
    const r = applyDragStep(path, [2, 2], P);
    expect(r.kind).toBe('extend');
    expect(r.path).toHaveLength(5);
  });

  it('starts a path on 1', () => {
    expect(applyDragStep([], [0, 0], P).kind).toBe('start');
  });

  it('backtracks onto the previous cell', () => {
    const r = applyDragStep(path, [0, 2], P);
    expect(r.kind).toBe('backtrack');
    expect(r.path).toEqual(SOLUTION.slice(0, 3));
  });

  it('truncates to an earlier cell', () => {
    const r = applyDragStep(path, [0, 0], P);
    expect(r.kind).toBe('truncate');
    expect(r.path).toEqual([[0, 0]]);
  });

  it('does nothing on the head', () => {
    const r = applyDragStep(path, [1, 2], P);
    expect(r.kind).toBe('none');
    expect(r.path).toBe(path);
  });

  it('rejects walls and diagonals without changing the path', () => {
    expect(applyDragStep(path, [1, 1], P)).toEqual({ path, kind: 'invalid' }); // wall
    expect(applyDragStep(path, [2, 1], P)).toEqual({ path, kind: 'invalid' }); // diagonal
  });
});

describe('applyKeyStep', () => {
  const path: Path = SOLUTION.slice(0, 4);

  it('extends and backtracks', () => {
    expect(applyKeyStep(path, [2, 2], P).kind).toBe('extend');
    expect(applyKeyStep(path, [0, 2], P)).toEqual({ path: SOLUTION.slice(0, 3), kind: 'backtrack' });
  });

  it('rejects other visited cells instead of truncating', () => {
    const longer = SOLUTION.slice(0, 7); // head (1,1); (0,1) is visited but not previous
    expect(applyKeyStep(longer, [0, 1], P).kind).toBe('invalid');
  });
});

describe('applyPress', () => {
  it('truncates when pressing a path cell (tap to cut)', () => {
    const r = applyPress(SOLUTION.slice(0, 5), [0, 1], P);
    expect(r).toEqual({ path: SOLUTION.slice(0, 2), kind: 'truncate' });
  });
  it('starts on 1 and rejects other empty-path presses', () => {
    expect(applyPress([], [0, 0], P).kind).toBe('start');
    expect(applyPress([], [1, 1], P).kind).toBe('invalid');
  });
  it('extends when pressing a legal neighbour of the head', () => {
    expect(applyPress([[0, 0]], [0, 1], P).kind).toBe('extend');
  });
  it('startCell finds number 1', () => {
    expect(startCell(P)).toEqual([0, 0]);
  });
});
