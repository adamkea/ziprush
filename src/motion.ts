/** JS-side motion timings (seconds), mirroring the --dur-* tokens. */
export const MOTION = {
  segment: 0.09, // grow/shrink of one path segment
  headMove: 0.08,
  pulse: 0.28, // number pulse
  shake: 0.28,
  sweep: 0.42, // solve light sweep, start of sequence
  popDelay: 0.36,
  pop: 0.26,
  messageDelay: 0.5, // "Solved!" appears; sequence ends ~0.68s
  message: 0.18,
  autoAdvance: 1.5, // solved -> next stage starts switching (after the sequence settles)
  stageOut: 0.26, // outgoing board slides away
  stageIn: 0.34, // incoming board slides in
} as const;

/** Shared SVG geometry: one cell is 100 user units; PAD leaves room for walls and glow. */
export const CELL = 100;
export const PAD = 14;
export const centreOf = (i: number) => i * CELL + CELL / 2;
