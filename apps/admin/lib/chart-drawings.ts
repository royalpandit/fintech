/**
 * Chart drawing model + persistence.
 *
 * Drawings are stored in *chart space* — a fractional logical bar index paired
 * with a price — never in pixels, so they stay anchored to the same candles
 * when the user pans, zooms or resizes. The overlay converts to pixels at paint
 * time.
 *
 * Logical index rather than timestamp deliberately: `timeToCoordinate` only
 * resolves times that exist as bars, which would snap freehand strokes to bar
 * boundaries and refuse any drawing in the empty right margin.
 * `logicalToCoordinate` is fractional and defined everywhere. The trade-off is
 * that indices are relative to the loaded data window, so the storage key
 * includes the timeframe.
 *
 * Persistence is localStorage keyed per instrument+timeframe — drawings survive
 * a reload without needing a schema change or a server round trip.
 */

export type DrawingPoint = { logical: number; price: number };

export type Drawing =
  | { id: string; kind: "trend"; a: DrawingPoint; b: DrawingPoint; color: string }
  | { id: string; kind: "vline"; logical: number; color: string }
  | { id: string; kind: "rect"; a: DrawingPoint; b: DrawingPoint; color: string }
  | { id: string; kind: "fib"; a: DrawingPoint; b: DrawingPoint; color: string }
  | { id: string; kind: "text"; at: DrawingPoint; text: string; color: string }
  | { id: string; kind: "pencil"; points: DrawingPoint[]; color: string };

export type DrawingKind = Drawing["kind"];

/** Tools that draw onto the overlay (vs. cursor/crosshair/hline/eraser). */
export const DRAWING_TOOLS: DrawingKind[] = ["trend", "vline", "rect", "fib", "text", "pencil"];

export function isDrawingTool(tool: string): tool is DrawingKind {
  return (DRAWING_TOOLS as string[]).includes(tool);
}

/** Tools that take over the pointer — drawing tools plus the eraser. */
export function toolCapturesPointer(tool: string): boolean {
  return isDrawingTool(tool) || tool === "eraser";
}

export const DEFAULT_DRAWING_COLOR = "#0ea5e9";

/** Standard retracement levels, drawn between the two anchor prices. */
export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

export function newDrawingId(): string {
  return `d${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

// ── Persistence ─────────────────────────────────────────────────────────────

const STORAGE_PREFIX = "finuer-chart-drawings:";

function storageKey(instrumentKey: string): string {
  return `${STORAGE_PREFIX}${instrumentKey}`;
}

export function loadDrawings(instrumentKey: string): Drawing[] {
  if (typeof window === "undefined" || !instrumentKey) return [];
  try {
    const raw = window.localStorage.getItem(storageKey(instrumentKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Drawing[]) : [];
  } catch {
    return [];
  }
}

export function saveDrawings(instrumentKey: string, drawings: Drawing[]): void {
  if (typeof window === "undefined" || !instrumentKey) return;
  try {
    if (!drawings.length) window.localStorage.removeItem(storageKey(instrumentKey));
    else window.localStorage.setItem(storageKey(instrumentKey), JSON.stringify(drawings));
  } catch {
    // Quota / private mode — drawings simply don't persist.
  }
}

// ── Hit testing (screen space) ───────────────────────────────────────────────

export type ScreenPoint = { x: number; y: number };

function distToSegment(p: ScreenPoint, a: ScreenPoint, b: ScreenPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Distance in pixels from `p` to a drawing already projected to screen points.
 * Returns Infinity when the drawing isn't currently on screen.
 */
export function distanceToShape(
  p: ScreenPoint,
  shape: { kind: DrawingKind; points: ScreenPoint[]; height?: number },
): number {
  const pts = shape.points;
  if (!pts.length) return Infinity;

  switch (shape.kind) {
    case "vline": {
      return Math.abs(p.x - pts[0].x);
    }
    case "trend":
      return pts.length < 2 ? Infinity : distToSegment(p, pts[0], pts[1]);
    case "rect":
    case "fib": {
      if (pts.length < 2) return Infinity;
      const [a, b] = pts;
      const left = Math.min(a.x, b.x);
      const right = Math.max(a.x, b.x);
      const top = Math.min(a.y, b.y);
      const bottom = Math.max(a.y, b.y);
      // Inside counts as a hit; outside measures to the nearest edge.
      const dx = Math.max(left - p.x, 0, p.x - right);
      const dy = Math.max(top - p.y, 0, p.y - bottom);
      return Math.hypot(dx, dy);
    }
    case "text": {
      const a = pts[0];
      const h = shape.height ?? 14;
      const dy = Math.max(a.y - h - p.y, 0, p.y - a.y);
      const dx = Math.max(a.x - p.x, 0, p.x - a.x - 60);
      return Math.hypot(dx, dy);
    }
    case "pencil": {
      let best = Infinity;
      for (let i = 1; i < pts.length; i++) {
        best = Math.min(best, distToSegment(p, pts[i - 1], pts[i]));
      }
      return pts.length === 1 ? Math.hypot(p.x - pts[0].x, p.y - pts[0].y) : best;
    }
    default:
      return Infinity;
  }
}
