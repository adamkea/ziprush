import { describe, expect, it } from 'vitest';
import { buildShareText, formatTime, stageEmoji, totalBacktracks, totalMs } from './score';

describe('formatTime', () => {
  it('formats minutes, seconds and tenths', () => {
    expect(formatTime(0)).toBe('0:00.0');
    expect(formatTime(9_999)).toBe('0:09.9');
    expect(formatTime(83_400)).toBe('1:23.4');
    expect(formatTime(600_000)).toBe('10:00.0');
  });
  it('clamps negatives', () => {
    expect(formatTime(-50)).toBe('0:00.0');
  });
});

describe('share text', () => {
  const results = [
    { size: 4, ms: 5_200, backtracks: 0 },
    { size: 5, ms: 12_000, backtracks: 2 },
    { size: 6, ms: 30_100, backtracks: 7 },
  ];

  it('totals the run', () => {
    expect(totalMs(results)).toBe(47_300);
    expect(totalBacktracks(results)).toBe(9);
  });

  it('grades each stage', () => {
    expect(results.map(stageEmoji)).toEqual(['⚡', '🟩', '🟨']);
  });

  it('builds a pasteable summary with an optional link', () => {
    expect(buildShareText(results, 'https://example.com/')).toBe(
      [
        'ZipRush 3/3 in 0:47.3',
        '⚡🟩🟨',
        '1. 4×4  0:05.2  ⚡',
        '2. 5×5  0:12.0',
        '3. 6×6  0:30.1',
        '',
        'https://example.com/',
      ].join('\n'),
    );
    expect(buildShareText(results)).not.toContain('http');
  });
});
