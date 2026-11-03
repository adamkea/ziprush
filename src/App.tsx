import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Board, type BoardHandle } from './components/Board';
import { puzzles } from './puzzles';
import { isSolved, maxNumber, nextRequiredNumber } from './game/rules';
import type { Path } from './game/types';
import { MOTION } from './motion';
import styles from './App.module.css';

/** Stage switch: the solved board slides out left while shrinking, the next one slides in from the right. */
const stageVariants = {
  enter: (reduced: boolean) =>
    reduced ? { opacity: 0 } : { opacity: 0, x: '45%', scale: 0.9, rotate: 2 },
  center: (reduced: boolean) => ({
    opacity: 1,
    x: 0,
    scale: 1,
    rotate: 0,
    transition: reduced
      ? { duration: MOTION.stageIn }
      : { duration: MOTION.stageIn, ease: [0.22, 1, 0.36, 1] as const },
  }),
  exit: (reduced: boolean) =>
    reduced
      ? { opacity: 0, transition: { duration: MOTION.stageOut } }
      : {
          opacity: 0,
          x: '-45%',
          scale: 0.9,
          rotate: -2,
          transition: { duration: MOTION.stageOut, ease: [0.55, 0, 1, 0.45] as const },
        },
};

export function App() {
  const [index, setIndex] = useState(0);
  const [path, setPath] = useState<Path>([]);
  const boardRef = useRef<BoardHandle>(null);
  const reducedMotion = useReducedMotion() ?? false;

  const puzzle = puzzles[index]!;
  const total = puzzle.size * puzzle.size;
  const solved = useMemo(() => isSolved(path, puzzle), [path, puzzle]);
  const next = nextRequiredNumber(path, puzzle);

  const undo = useCallback(() => setPath((p) => p.slice(0, -1)), []);
  const reset = useCallback(() => setPath([]), []);
  /** Set when switching stages; the incoming board takes focus once it has slid in. */
  const focusOnEnter = useRef(false);
  const nextPuzzle = useCallback(() => {
    focusOnEnter.current = true;
    setIndex((i) => (i + 1) % puzzles.length);
    setPath([]);
  }, []);

  // Completing a stage moves on automatically once the solve celebration has played.
  useEffect(() => {
    if (!solved) return;
    const t = window.setTimeout(nextPuzzle, MOTION.autoAdvance * 1000);
    return () => window.clearTimeout(t);
  }, [solved, nextPuzzle]);

  const status = solved
    ? 'Every cell, in order. Nice. Next stage coming up…'
    : path.length === 0
      ? 'Start on 1, connect the numbers in order, fill every cell.'
      : next
        ? `Next: ${next} of ${maxNumber(puzzle)}`
        : 'All numbers reached. Fill the remaining cells.';

  return (
    <main className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.title}>
          Zip<span>Rush</span>
        </h1>
        <p className={styles.meta}>
          Puzzle {index + 1}/{puzzles.length} · {puzzle.size}×{puzzle.size}
          {puzzle.walls?.length ? ' · walls' : ''}
        </p>
      </header>

      <section className={styles.stage}>
        <AnimatePresence mode="wait" initial={false} custom={reducedMotion}>
          <motion.div
            key={puzzle.id}
            className={styles.boardSlot}
            custom={reducedMotion}
            variants={stageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            onAnimationComplete={(def) => {
              // Keep keyboard players on the board after a switch.
              if (def === 'center' && focusOnEnter.current) {
                focusOnEnter.current = false;
                boardRef.current?.focus();
              }
            }}
          >
            <Board
              ref={boardRef}
              puzzle={puzzle}
              path={path}
              onPathChange={setPath}
              solved={solved}
              reducedMotion={reducedMotion}
            />
          </motion.div>
        </AnimatePresence>
      </section>

      <div className={styles.progress} aria-hidden="true">
        <div
          className={styles.progressFill}
          style={{ transform: `scaleX(${path.length / total})` }}
        />
      </div>
      <p className={styles.status} role="status" aria-live="polite">
        {status}
      </p>

      <div className={styles.footer}>
        <AnimatePresence mode="wait" initial={false}>
          {solved ? (
            <motion.div
              key="solved"
              className={styles.solved}
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: MOTION.message, delay: MOTION.messageDelay }}
            >
              <span className={styles.solvedText}>Solved!</span>
              <button className={`${styles.btn} ${styles.primary} ${styles.advance}`} onClick={nextPuzzle}>
                {/* Fills over the auto-advance delay; clicking skips the wait. */}
                <span
                  className={styles.advanceFill}
                  style={{ animationDuration: `${MOTION.autoAdvance}s` }}
                  aria-hidden="true"
                />
                <span className={styles.advanceLabel}>Next puzzle →</span>
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="controls"
              className={styles.controls}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
            >
              <button className={styles.btn} onClick={undo} disabled={path.length === 0}>
                Undo
              </button>
              <button className={styles.btn} onClick={reset} disabled={path.length === 0}>
                Reset
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
