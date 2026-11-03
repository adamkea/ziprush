import { memo, useEffect, useId, useRef } from 'react';
import { AnimatePresence, motion, type Variants } from 'motion/react';
import { cellKey } from '../game/rules';
import type { Path } from '../game/types';
import { pathColor } from '../game/color';
import { MOTION, centreOf } from '../motion';
import styles from './Board.module.css';

interface ExitInfo {
  /** Path length before the change that removed segments. */
  oldLen: number;
  /** Stagger between successive removed segments (s). */
  step: number;
}

/** Variants for one segment; index captured so removal can retract head-first. */
function segmentVariants(index: number, reduced: boolean): Variants {
  if (reduced) {
    return {
      hidden: { opacity: 0 },
      shown: { opacity: 1, transition: { duration: MOTION.segment } },
      exit: { opacity: 0, transition: { duration: MOTION.segment } },
    };
  }
  return {
    hidden: { pathLength: 0 },
    shown: (enterDelay: number) => ({
      pathLength: 1,
      transition: { duration: MOTION.segment, ease: 'linear', delay: enterDelay },
    }),
    // Segments furthest along the path retract first, so the line visibly shrinks back.
    exit: (info: ExitInfo) => ({
      pathLength: 0,
      transition: {
        duration: MOTION.segment,
        ease: 'linear',
        delay: Math.max(0, info.oldLen - 1 - index) * info.step,
      },
    }),
  };
}

/** The wrapper only propagates variant labels to its line (and keeps the gradient alive during exit). */
const GROUP_VARIANTS: Variants = { hidden: {}, shown: {}, exit: {} };

export const PathLayer = memo(function PathLayer({
  path,
  total,
  reducedMotion,
}: {
  path: Path;
  total: number;
  reducedMotion: boolean;
}) {
  // Remember the previous length to stagger multi-cell additions/removals.
  const prevLen = useRef(path.length);
  const before = prevLen.current;
  useEffect(() => {
    prevLen.current = path.length;
  }, [path.length]);

  const removed = Math.max(0, before - path.length);
  const added = Math.max(0, path.length - before);
  const exitInfo: ExitInfo = { oldLen: before, step: removed > 1 ? Math.min(0.035, 0.2 / removed) : 0 };
  const enterStep = added > 1 ? Math.min(0.03, 0.15 / added) : 0;

  const head = path[path.length - 1];
  const denom = Math.max(1, total - 1);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');

  return (
    <g>
      <g filter="url(#path-glow)">
        {/* A lone start cell still gets a visible blob of path colour. */}
        {path.length === 1 && head && (
          <circle cx={centreOf(head[1])} cy={centreOf(head[0])} r={17} fill={pathColor(0)} />
        )}
        <AnimatePresence custom={exitInfo} initial={false}>
          {path.slice(1).map((cell, j) => {
            const i = j + 1; // segment i ends at path[i]
            const prev = path[i - 1]!;
            const key = `${cellKey(prev)}>${cellKey(cell)}`;
            const gradId = `seg${uid}-${prev[0]}-${prev[1]}-${cell[0]}-${cell[1]}`;
            const x1 = centreOf(prev[1]);
            const y1 = centreOf(prev[0]);
            const x2 = centreOf(cell[1]);
            const y2 = centreOf(cell[0]);
            // Each segment fades from the previous segment's colour to its own, so the
            // overlapping round caps at a joint are exactly the same colour (no seams).
            return (
              <motion.g
                key={key}
                variants={GROUP_VARIANTS}
                initial="hidden"
                animate="shown"
                exit="exit"
              >
                <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1={x1} y1={y1} x2={x2} y2={y2}>
                  <stop offset="0" stopColor={pathColor((i - 1) / denom)} />
                  <stop offset="1" stopColor={pathColor(i / denom)} />
                </linearGradient>
                <motion.line
                  className={styles.segment}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={`url(#${gradId})`}
                  variants={segmentVariants(i, reducedMotion)}
                  custom={Math.max(0, i - before) * enterStep}
                />
              </motion.g>
            );
          })}
        </AnimatePresence>
      </g>

      {head && (
        <motion.g
          className={styles.head}
          initial={false}
          animate={{ x: centreOf(head[1]), y: centreOf(head[0]) }}
          transition={reducedMotion ? { duration: 0 } : { duration: MOTION.headMove, ease: 'easeOut' }}
        >
          <circle className={styles.headHalo} r={30} fill={pathColor((path.length - 1) / denom)} />
          <circle className={styles.headCore} r={9} />
        </motion.g>
      )}
    </g>
  );
});

/** Light sweep that travels the full path on solve. */
export function SolveSweep({ path }: { path: Path }) {
  const points = path.map(([r, c]) => `${centreOf(c)},${centreOf(r)}`).join(' ');
  return (
    <motion.polyline
      className={styles.sweep}
      points={points}
      pathLength={1}
      strokeDasharray="0.16 2"
      initial={{ strokeDashoffset: 0.16, opacity: 1 }}
      animate={{ strokeDashoffset: -1, opacity: [1, 1, 0] }}
      transition={{ duration: MOTION.sweep, ease: 'easeInOut', opacity: { times: [0, 0.8, 1], duration: MOTION.sweep } }}
    />
  );
}
