import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { motion, useAnimate } from 'motion/react';
import type { Cell, Path, Puzzle, StepKind } from '../game/types';
import {
  applyDragStep,
  applyKeyStep,
  applyPress,
  canExtend,
  cellKey,
  maxNumber,
  nextRequiredNumber,
  startCell,
} from '../game/rules';
import { cellAt, cellsAlongSegment, clampToGrid, withinCell, type GridPoint } from '../game/geometry';
import { pathColor } from '../game/color';
import { CELL, MOTION, PAD, centreOf } from '../motion';
import { CellTint, NumberDisc } from './Cell';
import { PathLayer, SolveSweep } from './PathLayer';
import { Walls } from './Walls';
import styles from './Board.module.css';

/** How far (in cells) the pointer must leave its cell before we react. Stops edge jitter. */
const HYSTERESIS = 0.12;
/** Minimum gap between invalid-move feedback, so a wiggle into a wall shakes once. */
const INVALID_COOLDOWN_MS = 320;
/**
 * Furthest the live tail may stretch from the head's centre (cells). Matches the point
 * where the pointer commits the next cell, so the line end tracks the finger continuously.
 */
const TAIL_MAX = 0.5 + HYSTERESIS;

export interface BoardProps {
  puzzle: Puzzle;
  path: Path;
  onPathChange: (path: Path) => void;
  solved: boolean;
  reducedMotion: boolean;
}

export interface BoardHandle {
  focus: () => void;
}

interface DragState {
  pointerId: number;
  rect: DOMRect;
  lastCell: Cell;
  lastPoint: GridPoint;
  /** Last cell that produced invalid feedback during this drag. */
  lastInvalid: string | null;
}

const KEY_DIRS: Record<string, readonly [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

export const Board = forwardRef<BoardHandle, BoardProps>(function Board(
  { puzzle, path, onPathChange, solved, reducedMotion },
  ref,
) {
  const { size } = puzzle;
  const total = size * size;
  const viewSize = size * CELL + PAD * 2;

  const svgRef = useRef<SVGSVGElement>(null);
  const [scope, animate] = useAnimate<HTMLDivElement>();
  useImperativeHandle(ref, () => ({ focus: () => svgRef.current?.focus() }), []);

  // The handlers read the latest path from a ref and write to it immediately, so
  // several pointer events arriving before React re-renders still chain correctly.
  const pathRef = useRef(path);
  useLayoutEffect(() => {
    pathRef.current = path;
  }, [path]);

  const drag = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState(false);
  const lastInvalidAt = useRef(0);

  // ----- Live tail -----
  // Between cell commits, the head and a short tail follow the pointer directly (no React
  // render), so the line end tracks the finger instead of hopping cell to cell.
  const headRef = useRef<SVGGElement>(null);
  const tailRef = useRef<SVGLineElement>(null);
  const tailOffset = useRef<readonly [number, number]>([0, 0]);

  const placeHead = useCallback(() => {
    const head = pathRef.current[pathRef.current.length - 1];
    const g = headRef.current;
    const t = tailRef.current;
    if (!head || !g || !t) return;
    const x = centreOf(head[1]);
    const y = centreOf(head[0]);
    const [dx, dy] = tailOffset.current;
    g.style.transform = `translate(${x + dx}px, ${y + dy}px)`;
    t.setAttribute('x1', String(x));
    t.setAttribute('y1', String(y));
    t.setAttribute('x2', String(x + dx));
    t.setAttribute('y2', String(y + dy));
  }, []);

  /** Offset (SVG units) of the line end from the head centre, toward the pointer along one axis. */
  const computeTail = (point: GridPoint): readonly [number, number] => {
    const p = pathRef.current;
    const head = p[p.length - 1];
    if (!head) return [0, 0];
    const fx = point.x - (head[1] + 0.5);
    const fy = point.y - (head[0] + 0.5);
    const horiz = Math.abs(fx) >= Math.abs(fy);
    const along = horiz ? fx : fy;
    const dir = Math.sign(along);
    if (dir === 0) return [0, 0];
    const target: Cell = horiz ? [head[0], head[1] + dir] : [head[0] + dir, head[1]];
    // Only stretch toward a cell the path could actually enter (not walls, visited cells, out of order numbers).
    if (!canExtend(p, target, puzzle)) return [0, 0];
    const len = Math.min(Math.abs(along), TAIL_MAX) * dir * CELL;
    return horiz ? [len, 0] : [0, len];
  };

  // Keep the head in place after every path change (React owns the path, we own the tail).
  useLayoutEffect(() => {
    if (!drag.current) tailOffset.current = [0, 0];
    placeHead();
  }, [path, placeHead]);

  const feedbackInvalid = useCallback(() => {
    const now = performance.now();
    if (now - lastInvalidAt.current < INVALID_COOLDOWN_MS) return;
    lastInvalidAt.current = now;
    navigator.vibrate?.(10);
    const el = scope.current;
    if (!el) return;
    if (reducedMotion) {
      animate(el, { opacity: [1, 0.75, 1] }, { duration: MOTION.shake });
    } else {
      animate(el, { x: [0, -7, 6, -4, 3, 0] }, { duration: MOTION.shake, ease: 'easeOut' });
    }
  }, [animate, reducedMotion, scope]);

  const commit = useCallback(
    (next: Path) => {
      if (next === pathRef.current) return;
      pathRef.current = next;
      onPathChange(next);
    },
    [onPathChange],
  );

  /** Client coordinates -> fractional grid coordinates (cells). */
  const toGrid = (clientX: number, clientY: number, rect: DOMRect): GridPoint => {
    const scale = viewSize / rect.width;
    return {
      x: ((clientX - rect.left) * scale - PAD) / CELL,
      y: ((clientY - rect.top) * scale - PAD) / CELL,
    };
  };

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (solved || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect(); // cached for the whole gesture
    const point = toGrid(e.clientX, e.clientY, rect);
    // Presses in the outer padding are ignored rather than snapped to an edge cell.
    if (point.x < 0 || point.y < 0 || point.x >= size || point.y >= size) return;

    e.preventDefault();
    svg.setPointerCapture(e.pointerId);

    const cell = cellAt(point);
    const res = applyPress(pathRef.current, cell, puzzle);
    if (res.kind === 'invalid') feedbackInvalid();
    commit(res.path);
    drag.current = {
      pointerId: e.pointerId,
      rect,
      lastCell: cell,
      lastPoint: point,
      lastInvalid: res.kind === 'invalid' ? cellKey(cell) : null,
    };
    setDragging(true);
    tailOffset.current = computeTail(point);
    placeHead();
  };

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const point = clampToGrid(toGrid(e.clientX, e.clientY, d.rect), size);
    if (withinCell(point, d.lastCell, HYSTERESIS)) {
      tailOffset.current = computeTail(point);
      placeHead();
      return;
    }

    // Walk every cell between the last and current pointer position, in order,
    // so fast swipes never skip cells.
    const cells = cellsAlongSegment(d.lastPoint, point, size, d.lastCell);
    let next = pathRef.current;
    let invalid = false;
    for (const cell of cells) {
      const res = applyDragStep(next, cell, puzzle);
      next = res.path;
      if (res.kind === 'invalid') {
        const k = cellKey(cell);
        if (k !== d.lastInvalid) invalid = true;
        d.lastInvalid = k;
      } else if (res.kind !== 'none') {
        d.lastInvalid = null;
      }
    }
    d.lastPoint = point;
    d.lastCell = cells.at(-1) ?? d.lastCell;
    if (invalid) feedbackInvalid();
    commit(next);
    tailOffset.current = computeTail(point);
    placeHead();
  };

  const endDrag = (e: PointerEvent<SVGSVGElement>) => {
    if (drag.current?.pointerId !== e.pointerId) return;
    drag.current = null;
    setDragging(false);
    // Snap the line end back to the head cell's centre.
    tailOffset.current = [0, 0];
    placeHead();
  };

  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (solved) return;
    if (e.key === 'Backspace') {
      e.preventDefault();
      commit(pathRef.current.slice(0, -1));
      return;
    }
    const dir = KEY_DIRS[e.key];
    if (!dir) return;
    e.preventDefault();
    const current = pathRef.current;
    const head = current[current.length - 1];
    let kind: StepKind;
    if (!head) {
      // First arrow press drops the player on number 1.
      const start = startCell(puzzle);
      if (!start) return;
      const res = applyKeyStep(current, start, puzzle);
      kind = res.kind;
      commit(res.path);
    } else {
      const res = applyKeyStep(current, [head[0] + dir[0], head[1] + dir[1]], puzzle);
      kind = res.kind;
      commit(res.path);
    }
    if (kind === 'invalid') feedbackInvalid();
  };

  // Solve sequence: sweep (in SVG) -> gentle pop of the board.
  useEffect(() => {
    if (!solved || !scope.current) return;
    drag.current = null;
    setDragging(false);
    tailOffset.current = [0, 0];
    placeHead();
    if (reducedMotion) return;
    animate(
      scope.current,
      { scale: [1, 1.04, 1] },
      { delay: MOTION.popDelay, duration: MOTION.pop, ease: 'easeOut' },
    );
  }, [solved, reducedMotion, animate, scope, placeHead]);

  // ----- Derived render data (cheap; per-cell components are memoised) -----
  const indexByKey = useMemo(() => {
    const m = new Map<string, number>();
    path.forEach((c, i) => m.set(cellKey(c), i));
    return m;
  }, [path]);

  const nextNumber = useMemo(() => nextRequiredNumber(path, puzzle), [path, puzzle]);
  const denom = Math.max(1, total - 1);
  const headColor = pathColor(Math.max(0, path.length - 1) / denom);

  const gridLines = useMemo(() => {
    let d = '';
    for (let i = 1; i < size; i++) {
      d += `M${i * CELL} 0V${size * CELL}M0 ${i * CELL}H${size * CELL}`;
    }
    return d;
  }, [size]);

  const numberEntries = useMemo(
    () =>
      Object.entries(puzzle.numbers).map(([key, value]) => {
        const [r, c] = key.split(',').map(Number) as [number, number];
        return { key, r, c, value };
      }),
    [puzzle.numbers],
  );

  const cells: { r: number; c: number; key: string }[] = useMemo(() => {
    const out = [];
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) out.push({ r, c, key: `${r},${c}` });
    return out;
  }, [size]);

  const n = maxNumber(puzzle);
  const ariaLabel = solved
    ? 'Puzzle solved'
    : `${size} by ${size} Zip puzzle. ${path.length} of ${total} cells filled.` +
      (nextNumber ? ` Next number ${nextNumber} of ${n}.` : '') +
      ' Use arrow keys to draw, Backspace to undo.';

  return (
    <motion.div ref={scope} className={styles.wrap}>
      <svg
        ref={svgRef}
        className={styles.board}
        viewBox={`${-PAD} ${-PAD} ${viewSize} ${viewSize}`}
        role="application"
        aria-label={ariaLabel}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onKeyDown={onKeyDown}
        onContextMenu={(e) => e.preventDefault()}
      >
        <defs>
          {/* Soft halo as a gradient rather than a blur filter: no per-frame filter work. */}
          <radialGradient id="head-halo">
            <stop offset="0.35" stopColor={headColor} stopOpacity={0.5} />
            <stop offset="1" stopColor={headColor} stopOpacity={0} />
          </radialGradient>
          {/* Region in board units: a %-of-bbox region collapses to nothing for a straight
              (zero-width) path, hiding it entirely. */}
          <filter
            id="path-glow"
            filterUnits="userSpaceOnUse"
            x={-PAD}
            y={-PAD}
            width={viewSize}
            height={viewSize}
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur" />
            {/* Halo strength; filter attributes cannot read CSS variables. */}
            <feComponentTransfer in="blur" result="soft">
              <feFuncA type="linear" slope="0.6" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode in="soft" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect
          className={styles.surface}
          x={-PAD}
          y={-PAD}
          width={viewSize}
          height={viewSize}
          rx={28}
        />
        <path className={styles.grid} d={gridLines} />

        <g>
          {cells.map(({ r, c, key }) => {
            const i = indexByKey.get(key);
            return (
              <CellTint key={key} row={r} col={c} color={i === undefined ? null : pathColor(i / denom)} />
            );
          })}
        </g>

        <Walls walls={puzzle.walls} />
        <PathLayer path={path} total={total} reducedMotion={reducedMotion} live={dragging} />

        {/* Head + live tail: positioned imperatively by placeHead(). */}
        <g style={{ display: path.length ? undefined : 'none' }}>
          <line ref={tailRef} className={styles.segment} stroke={headColor} />
          <g
            ref={headRef}
            className={`${styles.head} ${dragging || reducedMotion ? '' : styles.headEase}`}
          >
            <circle className={styles.headHalo} r={40} fill="url(#head-halo)" />
            <circle className={styles.headCore} r={9} />
          </g>
        </g>

        <g>
          {numberEntries.map(({ key, r, c, value }) => {
            const i = indexByKey.get(key);
            return (
              <NumberDisc
                key={key}
                row={r}
                col={c}
                value={value}
                reached={i !== undefined}
                isNext={!solved && value === nextNumber}
                color={i === undefined ? '' : pathColor(i / denom)}
                reducedMotion={reducedMotion}
              />
            );
          })}
        </g>

        {solved && !reducedMotion && <SolveSweep path={path} />}
      </svg>
    </motion.div>
  );
});
