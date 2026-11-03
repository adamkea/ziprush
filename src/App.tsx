import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Board, type BoardHandle } from './components/Board';
import { FinishScreen } from './components/FinishScreen';
import { puzzles } from './puzzles';
import { isSolved, maxNumber, nextRequiredNumber } from './game/rules';
import { formatTime, type StageResult } from './game/score';
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
          transition: {
            duration: MOTION.stageOut,
            ease: [0.55, 0, 1, 0.45] as const,
          },
        },
};

export function App() {
  const [index, setIndex] = useState(0);
  const [path, setPath] = useState<Path>([]);
  const [finished, setFinished] = useState(false);
  const [results, setResults] = useState<StageResult[]>([]);
  /** performance.now() of the first move on the current puzzle; the clock starts there. */
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const pathRef = useRef<Path>([]);
  const backtracks = useRef(0);
  const boardRef = useRef<BoardHandle>(null);
  const reducedMotion = useReducedMotion() ?? false;

  const puzzle = puzzles[index]!;
  const isLast = index === puzzles.length - 1;
  const total = puzzle.size * puzzle.size;
  const solved = useMemo(() => isSolved(path, puzzle), [path, puzzle]);
  const next = nextRequiredNumber(path, puzzle);
  const result = results[index];

  /** Every path change goes through here so we can start the clock and count backtracks. */
  const updatePath = useCallback((nextPath: Path) => {
    const prev = pathRef.current;
    if (nextPath.length < prev.length) backtracks.current += 1;
    if (nextPath.length > 0) {
      const t = performance.now();
      setStartedAt((s) => s ?? t);
    }
    pathRef.current = nextPath;
    setPath(nextPath);
  }, []);

  const undo = useCallback(() => updatePath(pathRef.current.slice(0, -1)), [updatePath]);
  const reset = useCallback(() => updatePath([]), [updatePath]);

  const resetStage = () => {
    pathRef.current = [];
    backtracks.current = 0;
    setPath([]);
    setStartedAt(null);
  };

  /** Set when switching stages; the incoming board takes focus once it has slid in. */
  const focusOnEnter = useRef(false);
  const advance = useCallback(() => {
    if (index === puzzles.length - 1) {
      setFinished(true);
      return;
    }
    focusOnEnter.current = true;
    setIndex(index + 1);
    resetStage();
  }, [index]);

  const playAgain = useCallback(() => {
    focusOnEnter.current = true;
    setIndex(0);
    setResults([]);
    setFinished(false);
    resetStage();
  }, []);

  // Record the solve time the moment the puzzle is solved (once per stage).
  useEffect(() => {
    if (!solved || startedAt === null) return;
    const ms = performance.now() - startedAt;
    const entry = { size: puzzle.size, ms, backtracks: backtracks.current };
    setResults((r) => (r.length > index ? r : [...r, entry]));
  }, [solved, startedAt, index, puzzle.size]);

  // Live clock while a puzzle is in progress.
  const running = startedAt !== null && !solved && !finished;
  useEffect(() => {
    if (!running) return;
    setNow(performance.now());
    const id = window.setInterval(() => setNow(performance.now()), 100);
    return () => window.clearInterval(id);
  }, [running]);
  const elapsed = result ? result.ms : startedAt === null ? 0 : Math.max(0, now - startedAt);
  const runTotal = results.slice(0, index).reduce((sum, r) => sum + r.ms, 0) + elapsed;

  // Completing a stage moves on automatically once the solve celebration has played.
  useEffect(() => {
    if (!solved || finished) return;
    const t = window.setTimeout(advance, MOTION.autoAdvance * 1000);
    return () => window.clearTimeout(t);
  }, [solved, finished, advance]);

  const status = solved
    ? `Solved in ${formatTime(elapsed)}. ${isLast ? 'Results coming up…' : 'Next stage coming up…'}`
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
        {finished ? (
          <p className={styles.meta}>Results</p>
        ) : (
          <p className={styles.meta}>
            Puzzle {index + 1}/{puzzles.length} · {puzzle.size}×{puzzle.size}
            {puzzle.walls?.length ? ' · walls' : ''}
            <span className={styles.clock} aria-label="Run time">
              {formatTime(runTotal)}
            </span>
          </p>
        )}
      </header>

      <section className={styles.stage}>
        <AnimatePresence mode="wait" initial={false} custom={reducedMotion}>
          {finished ? (
            <motion.div
              key="finish"
              className={styles.boardSlot}
              custom={reducedMotion}
              variants={stageVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              <FinishScreen results={results} onPlayAgain={playAgain} />
            </motion.div>
          ) : (
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
                onPathChange={updatePath}
                solved={solved}
                reducedMotion={reducedMotion}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {!finished && (
        <>
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
                  transition={{
                    duration: MOTION.message,
                    delay: MOTION.messageDelay,
                  }}
                >
                  <span className={styles.solvedText}>Solved!</span>
                  <button
                    className={`${styles.btn} ${styles.primary} ${styles.advance}`}
                    onClick={advance}
                  >
                    {/* Fills over the auto-advance delay; clicking skips the wait. */}
                    <span
                      className={styles.advanceFill}
                      style={{ animationDuration: `${MOTION.autoAdvance}s` }}
                      aria-hidden="true"
                    />
                    <span className={styles.advanceLabel}>
                      {isLast ? 'See results →' : 'Next puzzle →'}
                    </span>
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
        </>
      )}
    </main>
  );
}
