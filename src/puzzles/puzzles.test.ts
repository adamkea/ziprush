import { describe, expect, it } from 'vitest';
import { puzzles } from './index';
import { hasWall, isSolved, isValidPath, maxNumber } from '../game/rules';
import type { Cell } from '../game/types';

describe('sample puzzles', () => {
  it('ships the four required samples', () => {
    expect(puzzles.map((p) => p.size)).toEqual([4, 5, 6, 6]);
    expect(puzzles.some((p) => (p.walls?.length ?? 0) > 0)).toBe(true);
    expect(new Set(puzzles.map((p) => p.id)).size).toBe(puzzles.length);
  });

  for (const p of puzzles) {
    describe(p.id, () => {
      it('has numbers 1..N exactly once each, inside the grid', () => {
        const values = Object.values(p.numbers).sort((a, b) => a - b);
        expect(values).toEqual(Array.from({ length: maxNumber(p) }, (_, i) => i + 1));
        for (const key of Object.keys(p.numbers)) {
          const [r, c] = key.split(',').map(Number);
          expect(r).toBeGreaterThanOrEqual(0);
          expect(c).toBeLessThan(p.size);
        }
      });

      it('has walls only between adjacent in-grid cells', () => {
        for (const [a, b] of p.walls ?? []) {
          const [r1, c1] = a.split(',').map(Number) as [number, number];
          const [r2, c2] = b.split(',').map(Number) as [number, number];
          expect(Math.abs(r1 - r2) + Math.abs(c1 - c2)).toBe(1);
          expect(Math.max(r1, r2, c1, c2)).toBeLessThan(p.size);
        }
      });

      it('includes a solution that the rules accept', () => {
        const sol = p.solution as Cell[] | undefined;
        expect(sol).toBeDefined();
        expect(isValidPath(sol!, p)).toBe(true);
        expect(isSolved(sol!, p)).toBe(true);
      });

      it('solution never crosses a wall', () => {
        const sol = p.solution as Cell[];
        for (let i = 1; i < sol.length; i++) expect(hasWall(sol[i - 1]!, sol[i]!, p)).toBe(false);
      });
    });
  }
});
