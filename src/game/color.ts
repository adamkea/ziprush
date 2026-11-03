/**
 * Path colour ramp. Stops come from CSS tokens (--path-stop-0..2) so the palette lives
 * in tokens.css. Lightness falls steadily along the ramp, so position along the path
 * reads through brightness as well as hue (colour-blind friendly).
 */
type RGB = [number, number, number];

const FALLBACK = ['#7ff5e4', '#4c9dff', '#8a4dff'];

function parseHex(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

let stops: RGB[] | null = null;

function getStops(): RGB[] {
  if (stops) return stops;
  const style = typeof document !== 'undefined' ? getComputedStyle(document.documentElement) : null;
  stops = FALLBACK.map((fb, i) => {
    const v = style?.getPropertyValue(`--path-stop-${i}`) ?? '';
    return parseHex(v) ?? parseHex(fb)!;
  });
  return stops;
}

const toHex = ([r, g, b]: RGB) =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

/** Colour at position t ∈ [0, 1] along the full-length path. */
export function pathColor(t: number): string {
  const s = getStops();
  const x = Math.min(1, Math.max(0, t)) * (s.length - 1);
  const i = Math.min(s.length - 2, Math.floor(x));
  const f = x - i;
  const a = s[i]!;
  const b = s[i + 1]!;
  return toHex([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]);
}
