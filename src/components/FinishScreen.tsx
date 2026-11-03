import { useEffect, useRef, useState } from 'react';
import {
  buildShareText,
  formatTime,
  isClean,
  stageEmoji,
  totalBacktracks,
  totalMs,
  type StageResult,
} from '../game/score';
import styles from './FinishScreen.module.css';

const BEST_KEY = 'ziprush:best-ms';

function readBest(): number | null {
  try {
    const v = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

function writeBest(ms: number) {
  try {
    localStorage.setItem(BEST_KEY, String(Math.round(ms)));
  } catch {
    /* storage unavailable: best time just isn't remembered */
  }
}

/** Copy text without the async clipboard API (older browsers, insecure origins). */
function legacyCopy(text: string): boolean {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

interface Props {
  results: readonly StageResult[];
  onPlayAgain: () => void;
}

export function FinishScreen({ results, onPlayAgain }: Props) {
  const total = totalMs(results);
  const backtracks = totalBacktracks(results);
  const clean = results.filter(isClean).length;

  // Compare against the stored best once, when the run's results first show.
  const [best] = useState(() => {
    const prev = readBest();
    const isNew = prev === null || total < prev;
    if (isNew) writeBest(total);
    return { prev, isNew };
  });

  const [feedback, setFeedback] = useState('');
  const feedbackTimer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(feedbackTimer.current), []);
  const flash = (msg: string) => {
    setFeedback(msg);
    window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => setFeedback(''), 2200);
  };

  const shareText = () => buildShareText(results, window.location.href.split('#')[0]);

  const copy = async () => {
    const text = shareText();
    try {
      await navigator.clipboard.writeText(text);
      flash('Copied to clipboard');
    } catch {
      flash(legacyCopy(text) ? 'Copied to clipboard' : "Couldn't copy. Try Share instead.");
    }
  };

  const share = async () => {
    const text = shareText();
    if (navigator.share) {
      try {
        await navigator.share({ title: 'ZipRush', text });
        return;
      } catch (err) {
        // Dismissing the share sheet is not an error worth a fallback.
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
    await copy();
  };

  const shareRef = useRef<HTMLButtonElement>(null);
  useEffect(() => shareRef.current?.focus(), []);

  return (
    <div className={styles.card} role="region" aria-label="Results">
      <p className={styles.kicker}>All {results.length} puzzles cleared</p>
      <p className={styles.total} aria-label={`Total time ${formatTime(total)}`}>
        {formatTime(total)}
      </p>
      <p className={styles.best}>
        {best.isNew
          ? best.prev === null
            ? 'First run. That’s your time to beat.'
            : `New best! ${formatTime(best.prev - total)} faster`
          : `Best ${formatTime(best.prev!)}`}
      </p>

      <p className={styles.strip} aria-hidden="true">
        {results.map(stageEmoji).join(' ')}
      </p>

      <ol className={styles.splits}>
        {results.map((r, i) => (
          <li key={i} className={styles.split}>
            <span className={styles.splitName}>
              {i + 1}. {r.size}×{r.size}
            </span>
            <span className={styles.splitInfo}>
              {isClean(r)
                ? 'clean ⚡'
                : `${r.backtracks} backtrack${r.backtracks === 1 ? '' : 's'}`}
            </span>
            <span className={styles.splitTime}>{formatTime(r.ms)}</span>
          </li>
        ))}
      </ol>

      <p className={styles.summary}>
        {clean}/{results.length} clean · {backtracks} backtrack{backtracks === 1 ? '' : 's'}
      </p>

      <div className={styles.actions}>
        <button ref={shareRef} className={`${styles.btn} ${styles.primary}`} onClick={share}>
          Share score
        </button>
        <button className={styles.btn} onClick={copy}>
          Copy
        </button>
        <button className={styles.btn} onClick={onPlayAgain}>
          Play again
        </button>
      </div>
      <p className={styles.feedback} role="status" aria-live="polite">
        {feedback}
      </p>
    </div>
  );
}
