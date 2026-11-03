# ZipRush

A daily "Zip" path puzzle for the web. Draw one continuous path from **1** through every
number in order, filling every cell exactly once, ending on the last number. Walls block
movement between cells.

This stage is a single playable puzzle with polished input and visuals. Four sample
puzzles play in sequence: solving one automatically slides in the next after the solve
celebration (press "Next puzzle" to skip the wait). Each puzzle is timed from your first
move; after the fourth, a results screen shows the total time, per-puzzle splits and
backtracks, your best time (kept in this browser), and a **Share score** button (native
share sheet where available, otherwise copies a text summary). There is no daily seeding or
generator yet.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173 (add --host to try it on a phone on your LAN)
npm test           # unit tests (Vitest)
npm run build      # typecheck + production build into dist/
```

## Controls

- **Touch / mouse:** press on 1 (or the path head) and drag. Drag back to shrink the path;
  drag or tap onto any earlier cell to cut the path back to it.
- **Keyboard:** focus the board (Tab), then use the arrow keys to draw; moving onto the
  previous cell steps back. Backspace undoes.
- **Undo / Reset** buttons under the board.

## Layout

| Path | Purpose |
| --- | --- |
| `src/game/` | Pure game logic, no React: `rules.ts`, `geometry.ts` (swipe interpolation), `color.ts`, `score.ts` (timing + share text) |
| `src/puzzles/` | Puzzle JSON + loader; tests check every bundled solution is valid |
| `src/components/` | `Board` (SVG + pointer/keyboard input), `PathLayer`, `Cell`, `Walls`, `FinishScreen` |
| `src/styles/tokens.css` | All colours, radii, shadows and timings |

## Puzzle format

```jsonc
{
  "id": "sample-1",
  "size": 6,
  "numbers": { "0,0": 1, "2,3": 2, "5,5": 3 },  // "row,col": value
  "walls": [["1,1", "1,2"]],                    // optional: adjacent cell pairs
  "solution": [[0, 0], [0, 1]]                  // optional, tests only
}
```

Solving never compares against `solution`: any path that satisfies the rules counts.
