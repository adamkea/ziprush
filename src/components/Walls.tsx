import { memo } from 'react';
import type { Puzzle } from '../game/types';
import { CELL } from '../motion';
import styles from './Board.module.css';

const INSET = 10; // keep rounded wall ends off the grid corners

/** Thick rounded bars on the shared edge of each walled cell pair. */
export const Walls = memo(function Walls({ walls }: { walls: Puzzle['walls'] }) {
  if (!walls?.length) return null;
  const lines = walls.map(([a, b]) => {
    const [r1, c1] = a.split(',').map(Number) as [number, number];
    const [r2, c2] = b.split(',').map(Number) as [number, number];
    if (r1 === r2) {
      // Horizontal neighbours: vertical bar on the column boundary.
      const x = Math.max(c1, c2) * CELL;
      return { key: `${a}|${b}`, x1: x, y1: r1 * CELL + INSET, x2: x, y2: (r1 + 1) * CELL - INSET };
    }
    const y = Math.max(r1, r2) * CELL;
    return { key: `${a}|${b}`, x1: c1 * CELL + INSET, y1: y, x2: (c1 + 1) * CELL - INSET, y2: y };
  });
  return (
    <g>
      {lines.map(({ key, ...l }) => (
        <line key={`g${key}`} className={styles.wallGlow} {...l} />
      ))}
      {lines.map(({ key, ...l }) => (
        <line key={key} className={styles.wall} {...l} />
      ))}
    </g>
  );
});
