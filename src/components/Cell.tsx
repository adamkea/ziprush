import { memo } from 'react';
import { motion } from 'motion/react';
import { CELL, MOTION, centreOf } from '../motion';
import styles from './Board.module.css';

const INSET = 5;

/**
 * Background tint of a visited cell. Memoised on primitive props, so only cells whose
 * visited state or colour changes re-render while dragging.
 */
export const CellTint = memo(function CellTint({
  row,
  col,
  color,
}: {
  row: number;
  col: number;
  color: string | null;
}) {
  return (
    <rect
      className={styles.tint}
      x={col * CELL + INSET}
      y={row * CELL + INSET}
      width={CELL - INSET * 2}
      height={CELL - INSET * 2}
      rx={14}
      style={{ fill: color ?? 'transparent', fillOpacity: color ? undefined : 0 }}
    />
  );
});

/** Numbered disc. Pulses briefly when the path reaches it. */
export const NumberDisc = memo(function NumberDisc({
  row,
  col,
  value,
  reached,
  isNext,
  color,
  reducedMotion,
}: {
  row: number;
  col: number;
  value: number;
  reached: boolean;
  isNext: boolean;
  color: string;
  reducedMotion: boolean;
}) {
  const cx = centreOf(col);
  const cy = centreOf(row);
  return (
    <motion.g
      style={{ transformOrigin: `${cx}px ${cy}px`, transformBox: 'view-box' }}
      initial={false}
      animate={reached && !reducedMotion ? { scale: [1, 1.22, 1] } : { scale: 1 }}
      transition={{ duration: MOTION.pulse, ease: 'easeOut' }}
    >
      {isNext && <circle className={styles.nextRing} cx={cx} cy={cy} r={36} />}
      <circle
        className={styles.disc}
        cx={cx}
        cy={cy}
        r={29}
        style={reached ? { fill: color } : undefined}
      />
      <text className={styles.discText} x={cx} y={cy}>
        {value}
      </text>
    </motion.g>
  );
});
