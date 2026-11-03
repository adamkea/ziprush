import type { Puzzle } from '../game/types';
import p1 from './sample-1-4x4.json';
import p2 from './sample-2-5x5.json';
import p3 from './sample-3-6x6.json';
import p4 from './sample-4-6x6-walls.json';

/**
 * JSON imports are typed loosely (walls become string[][]), so check the shape
 * once at load time rather than trusting a cast.
 */
export function toPuzzle(raw: unknown): Puzzle {
  const p = raw as Record<string, unknown>;
  const fail = (msg: string): never => {
    throw new Error(`Invalid puzzle ${String(p?.id)}: ${msg}`);
  };
  if (typeof p.id !== 'string') fail('id');
  if (typeof p.size !== 'number' || p.size < 2 || p.size > 10) fail('size');
  if (typeof p.numbers !== 'object' || p.numbers === null) fail('numbers');
  const walls = (p.walls ?? []) as unknown[];
  if (!Array.isArray(walls)) fail('walls');
  for (const w of walls) {
    if (!Array.isArray(w) || w.length !== 2 || w.some((k) => typeof k !== 'string')) fail('wall pair');
  }
  return p as unknown as Puzzle;
}

export const puzzles: Puzzle[] = [p1, p2, p3, p4].map(toPuzzle);
