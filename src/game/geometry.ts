import type { Cell } from './types';

/** A point in grid units: x = column axis, y = row axis. (1.5, 0.5) is the centre of [0,1]. */
export interface GridPoint {
  x: number;
  y: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Clamp a point to stay strictly inside the grid so it always maps to a cell. */
export function clampToGrid(p: GridPoint, size: number): GridPoint {
  const max = size - 1e-6;
  return { x: clamp(p.x, 0, max), y: clamp(p.y, 0, max) };
}

export const cellAt = (p: GridPoint): Cell => [Math.floor(p.y), Math.floor(p.x)];

/**
 * True while `p` is still inside `cell` expanded by `margin` (in cell units).
 * Gives the pointer some hysteresis so wobbling on a cell edge does not flip-flop.
 */
export function withinCell(p: GridPoint, cell: Cell, margin: number): boolean {
  return (
    p.x >= cell[1] - margin &&
    p.x < cell[1] + 1 + margin &&
    p.y >= cell[0] - margin &&
    p.y < cell[0] + 1 + margin
  );
}

/**
 * Every cell crossed when moving in a straight line from `from` to `to`, in order,
 * excluding the starting cell. Consecutive cells are always orthogonally adjacent:
 * when the line passes exactly through a grid corner we emit two orthogonal steps
 * (horizontal first if the move is mostly horizontal, else vertical first).
 *
 * `startCell` lets the caller pin the starting cell (used with hysteresis, where the
 * pointer can be slightly outside the cell it is logically in).
 */
export function cellsAlongSegment(
  from: GridPoint,
  to: GridPoint,
  size: number,
  startCell: Cell = cellAt(clampToGrid(from, size)),
): Cell[] {
  const a = clampToGrid(from, size);
  const b = clampToGrid(to, size);
  const end = cellAt(b);

  // Start from a point inside startCell so the traversal begins there.
  const sx = clamp(a.x, startCell[1], startCell[1] + 1 - 1e-6);
  const sy = clamp(a.y, startCell[0], startCell[0] + 1 - 1e-6);

  const dx = b.x - sx;
  const dy = b.y - sy;
  const stepX = Math.sign(dx);
  const stepY = Math.sign(dy);

  // Amanatides & Woo grid traversal: tMax = param t at which we cross the next x/y line.
  const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDeltaY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  let tMaxX = dx > 0 ? (Math.floor(sx) + 1 - sx) / dx : dx < 0 ? (sx - Math.floor(sx)) / -dx : Infinity;
  let tMaxY = dy > 0 ? (Math.floor(sy) + 1 - sy) / dy : dy < 0 ? (sy - Math.floor(sy)) / -dy : Infinity;

  let row = startCell[0];
  let col = startCell[1];
  const out: Cell[] = [];
  const preferX = Math.abs(dx) >= Math.abs(dy);
  const EPS = 1e-9;

  // Bounded loop: at most |Δrow| + |Δcol| steps are needed.
  const maxSteps = Math.abs(end[0] - row) + Math.abs(end[1] - col);
  for (let i = 0; i < maxSteps; i++) {
    const tie = Math.abs(tMaxX - tMaxY) < EPS;
    const goX = tie ? preferX : tMaxX < tMaxY;
    if (goX && col !== end[1]) {
      col += stepX;
      tMaxX += tDeltaX;
    } else if (row !== end[0]) {
      row += stepY;
      tMaxY += tDeltaY;
    } else {
      col += stepX;
      tMaxX += tDeltaX;
    }
    out.push([row, col]);
  }
  return out;
}
