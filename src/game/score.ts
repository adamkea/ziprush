/** Per-run scoring: timing, formatting and the shareable summary. Pure, no React. */

export interface StageResult {
  /** Puzzle size (N for an N×N grid). */
  size: number;
  /** Solve time in milliseconds, from the first move to the solve. */
  ms: number;
  /** How many times the path was shortened (undo, drag back, cut, reset). */
  backtracks: number;
}

/** 83_400 -> "1:23.4". Tenths are floored so the display never runs ahead of the clock. */
export function formatTime(ms: number): string {
  const tenths = Math.floor(Math.max(0, ms) / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = Math.floor((tenths % 600) / 10);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths % 10}`;
}

export const totalMs = (results: readonly StageResult[]) =>
  results.reduce((sum, r) => sum + r.ms, 0);

export const totalBacktracks = (results: readonly StageResult[]) =>
  results.reduce((sum, r) => sum + r.backtracks, 0);

/** A clean solve never shortened the path. */
export const isClean = (r: StageResult) => r.backtracks === 0;

/** One emoji per stage: ⚡ clean, 🟩 a few backtracks, 🟨 more. */
export function stageEmoji(r: StageResult): string {
  if (isClean(r)) return '⚡';
  return r.backtracks <= 3 ? '🟩' : '🟨';
}

/** The text people paste into chats: score, an emoji strip, per-stage splits and a link. */
export function buildShareText(results: readonly StageResult[], url?: string): string {
  const lines = [
    `ZipRush ${results.length}/${results.length} in ${formatTime(totalMs(results))}`,
    results.map(stageEmoji).join(''),
    ...results.map(
      (r, i) => `${i + 1}. ${r.size}×${r.size}  ${formatTime(r.ms)}${isClean(r) ? '  ⚡' : ''}`,
    ),
  ];
  if (url) lines.push('', url);
  return lines.join('\n');
}
