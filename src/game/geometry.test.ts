import { describe, expect, it } from 'vitest';
import { cellsAlongSegment, withinCell } from './geometry';
import { isAdjacent } from './rules';
import type { Cell } from './types';

const centre = (r: number, c: number) => ({ x: c + 0.5, y: r + 0.5 });

/** Every consecutive pair (including the start cell) must be orthogonally adjacent. */
function expectContiguous(start: Cell, cells: Cell[]) {
  let prev = start;
  for (const c of cells) {
    expect(isAdjacent(prev, c)).toBe(true);
    prev = c;
  }
}

describe('cellsAlongSegment', () => {
  it('returns nothing when staying in the same cell', () => {
    expect(cellsAlongSegment({ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.9 }, 4)).toEqual([]);
  });

  it('fills every cell of a fast horizontal swipe in order', () => {
    expect(cellsAlongSegment(centre(1, 0), centre(1, 3), 4)).toEqual([
      [1, 1],
      [1, 2],
      [1, 3],
    ]);
  });

  it('works right-to-left and vertically', () => {
    expect(cellsAlongSegment(centre(2, 3), centre(2, 0), 4)).toEqual([
      [2, 2],
      [2, 1],
      [2, 0],
    ]);
    expect(cellsAlongSegment(centre(3, 1), centre(0, 1), 4)).toEqual([
      [2, 1],
      [1, 1],
      [0, 1],
    ]);
  });

  it('turns an exact diagonal into orthogonal steps', () => {
    const cells = cellsAlongSegment(centre(0, 0), centre(2, 2), 4);
    expect(cells).toHaveLength(4);
    expectContiguous([0, 0], cells);
    expect(cells.at(-1)).toEqual([2, 2]);
  });

  it('produces a contiguous staircase for shallow angles', () => {
    const cells = cellsAlongSegment({ x: 0.1, y: 0.4 }, { x: 5.9, y: 2.7 }, 6);
    expectContiguous([0, 0], cells);
    expect(cells.at(-1)).toEqual([2, 5]);
  });

  it('clamps points outside the board to the edge', () => {
    const cells = cellsAlongSegment(centre(0, 0), { x: 10, y: -3 }, 4);
    expect(cells).toEqual([
      [0, 1],
      [0, 2],
      [0, 3],
    ]);
  });

  it('honours a pinned start cell (hysteresis)', () => {
    // Pointer is just inside (0,1) but logically still in (0,0).
    const cells = cellsAlongSegment({ x: 1.05, y: 0.5 }, centre(0, 3), 4, [0, 0]);
    expect(cells).toEqual([
      [0, 1],
      [0, 2],
      [0, 3],
    ]);
  });

  it('stays contiguous on many random segments', () => {
    let seed = 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 8;
    for (let i = 0; i < 500; i++) {
      const a = { x: rnd(), y: rnd() };
      const b = { x: rnd(), y: rnd() };
      const start: Cell = [Math.floor(a.y), Math.floor(a.x)];
      const cells = cellsAlongSegment(a, b, 8);
      expectContiguous(start, cells);
      if (cells.length) expect(cells.at(-1)).toEqual([Math.floor(b.y), Math.floor(b.x)]);
    }
  });
});

describe('withinCell', () => {
  it('applies a margin around the cell', () => {
    expect(withinCell({ x: 1.1, y: 0.5 }, [0, 0], 0.15)).toBe(true);
    expect(withinCell({ x: 1.2, y: 0.5 }, [0, 0], 0.15)).toBe(false);
  });
});
