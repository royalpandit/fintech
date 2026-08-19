"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  DEFAULT_DRAWING_COLOR,
  FIB_LEVELS,
  distanceToShape,
  isDrawingTool,
  loadDrawings,
  newDrawingId,
  saveDrawings,
  toolCapturesPointer,
  type Drawing,
  type DrawingPoint,
  type ScreenPoint,
} from "@/lib/chart-drawings";

type TimeScaleApi = {
  logicalToCoordinate?: (logical: number) => number | null;
  coordinateToLogical?: (x: number) => number | null;
  subscribeVisibleLogicalRangeChange?: (fn: () => void) => void;
  unsubscribeVisibleLogicalRangeChange?: (fn: () => void) => void;
};

type ChartApi = { timeScale: () => TimeScaleApi };

type SeriesApi = {
  priceToCoordinate?: (price: number) => number | null;
  coordinateToPrice?: (y: number) => number | null;
};

type Props = {
  activeTool: string;
  chartRef: RefObject<ChartApi | null>;
  seriesRef: RefObject<SeriesApi | null>;
  paneRef: RefObject<HTMLDivElement | null>;
  /** Persistence scope (exchange:token:timeframe). Empty disables saving. */
  instrumentKey: string;
  /** Bumps on live tick / data change so the overlay re-projects. */
  refreshKey?: number;
  /** Let the eraser also clear a horizontal price line near the click. */
  onEraseNear?: (y: number) => boolean;
};

const ERASER_HIT_PX = 10;
const FIB_FILL = [
  "rgba(14,165,233,0.06)",
  "rgba(14,165,233,0.10)",
  "rgba(14,165,233,0.06)",
  "rgba(14,165,233,0.10)",
  "rgba(14,165,233,0.06)",
  "rgba(14,165,233,0.10)",
];

/** In-progress drag, held in screen space until it's committed. */
type Draft = {
  kind: "trend" | "rect" | "fib" | "pencil";
  from: ScreenPoint;
  to: ScreenPoint;
  path: ScreenPoint[];
};

export default function ChartDrawingLayer({
  activeTool,
  chartRef,
  seriesRef,
  paneRef,
  instrumentKey,
  refreshKey = 0,
  onEraseNear,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [textPrompt, setTextPrompt] = useState<{ at: ScreenPoint; value: string } | null>(null);
  const drawingsRef = useRef<Drawing[]>([]);
  drawingsRef.current = drawings;

  const capture = toolCapturesPointer(activeTool);

  // ── Load / persist per instrument ─────────────────────────────────────────
  useEffect(() => {
    setDrawings(loadDrawings(instrumentKey));
    setDraft(null);
    setTextPrompt(null);
  }, [instrumentKey]);

  // The settings panel can clear drawings for this instrument; it writes to
  // localStorage and fires this event so the overlay re-reads and repaints.
  useEffect(() => {
    const onCleared = () => setDrawings(loadDrawings(instrumentKey));
    window.addEventListener("finuer-drawings-cleared", onCleared);
    return () => window.removeEventListener("finuer-drawings-cleared", onCleared);
  }, [instrumentKey]);

  const commit = useCallback(
    (next: Drawing[]) => {
      setDrawings(next);
      saveDrawings(instrumentKey, next);
    },
    [instrumentKey],
  );

  // ── Chart-space ⇄ screen-space ────────────────────────────────────────────
  const toScreen = useCallback(
    (p: DrawingPoint): ScreenPoint | null => {
      const ts = chartRef.current?.timeScale();
      const series = seriesRef.current;
      const x = ts?.logicalToCoordinate?.(p.logical);
      const y = series?.priceToCoordinate?.(p.price);
      if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) return null;
      return { x, y };
    },
    [chartRef, seriesRef],
  );

  const toChart = useCallback(
    (p: ScreenPoint): DrawingPoint | null => {
      const ts = chartRef.current?.timeScale();
      const series = seriesRef.current;
      const logical = ts?.coordinateToLogical?.(p.x);
      const price = series?.coordinateToPrice?.(p.y);
      if (logical == null || price == null) return null;
      return { logical: Number(logical), price: Number(price) };
    },
    [chartRef, seriesRef],
  );

  /** Screen points for a drawing, or null when it's off-scale. */
  const project = useCallback(
    (d: Drawing): ScreenPoint[] | null => {
      const pane = paneRef.current;
      if (!pane) return null;
      switch (d.kind) {
        case "vline": {
          const ts = chartRef.current?.timeScale();
          const x = ts?.logicalToCoordinate?.(d.logical);
          if (x == null || !Number.isFinite(x)) return null;
          return [{ x, y: 0 }];
        }
        case "text": {
          const p = toScreen(d.at);
          return p ? [p] : null;
        }
        case "pencil": {
          const pts = d.points.map(toScreen);
          const valid = pts.filter((p): p is ScreenPoint => p != null);
          return valid.length ? valid : null;
        }
        default: {
          const a = toScreen(d.a);
          const b = toScreen(d.b);
          return a && b ? [a, b] : null;
        }
      }
    },
    [chartRef, paneRef, toScreen],
  );

  // ── Paint ─────────────────────────────────────────────────────────────────
  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const pane = paneRef.current;
    if (!canvas || !pane) return;

    const w = pane.clientWidth;
    const h = pane.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const drawVline = (x: number, color: string, dashed = false) => {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      if (dashed) ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
      ctx.restore();
    };

    const drawFib = (a: ScreenPoint, b: ScreenPoint, color: string) => {
      const left = Math.min(a.x, b.x);
      const right = Math.max(a.x, b.x);
      const span = b.y - a.y;
      ctx.save();
      ctx.font = "10px system-ui, sans-serif";
      FIB_LEVELS.forEach((level, i) => {
        const y = a.y + span * level;
        // Band fill between this level and the next.
        if (i < FIB_LEVELS.length - 1) {
          const yNext = a.y + span * FIB_LEVELS[i + 1];
          ctx.fillStyle = FIB_FILL[i % FIB_FILL.length];
          ctx.fillRect(left, Math.min(y, yNext), right - left, Math.abs(yNext - y));
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = level === 0 || level === 1 ? 1.4 : 1;
        ctx.setLineDash(level === 0 || level === 1 ? [] : [3, 3]);
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.fillStyle = color;
        ctx.fillText(`${(level * 100).toFixed(1)}%`, right + 4, y - 2);
      });
      ctx.restore();
    };

    const strokePath = (pts: ScreenPoint[], color: string, width = 1.6) => {
      if (pts.length < 2) return;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.restore();
    };

    for (const d of drawingsRef.current) {
      const pts = project(d);
      if (!pts) continue;
      switch (d.kind) {
        case "vline":
          drawVline(pts[0].x, d.color);
          break;
        case "trend":
          strokePath(pts, d.color);
          break;
        case "rect": {
          const [a, b] = pts;
          ctx.save();
          ctx.strokeStyle = d.color;
          ctx.fillStyle = "rgba(14,165,233,0.08)";
          ctx.lineWidth = 1.4;
          const x = Math.min(a.x, b.x);
          const y = Math.min(a.y, b.y);
          ctx.fillRect(x, y, Math.abs(b.x - a.x), Math.abs(b.y - a.y));
          ctx.strokeRect(x, y, Math.abs(b.x - a.x), Math.abs(b.y - a.y));
          ctx.restore();
          break;
        }
        case "fib":
          drawFib(pts[0], pts[1], d.color);
          break;
        case "text": {
          ctx.save();
          ctx.font = "600 12px system-ui, sans-serif";
          ctx.fillStyle = d.color;
          ctx.fillText(d.text, pts[0].x, pts[0].y);
          ctx.restore();
          break;
        }
        case "pencil":
          strokePath(pts, d.color);
          break;
      }
    }

    // Live preview of the in-progress drag.
    if (draft) {
      const color = DEFAULT_DRAWING_COLOR;
      if (draft.kind === "pencil") strokePath(draft.path, color);
      else if (draft.kind === "trend") strokePath([draft.from, draft.to], color);
      else if (draft.kind === "rect") {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 1.2;
        ctx.strokeRect(
          Math.min(draft.from.x, draft.to.x),
          Math.min(draft.from.y, draft.to.y),
          Math.abs(draft.to.x - draft.from.x),
          Math.abs(draft.to.y - draft.from.y),
        );
        ctx.restore();
      } else if (draft.kind === "fib") {
        drawFib(draft.from, draft.to, color);
      }
    }
  }, [draft, paneRef, project]);

  // Repaint on data/viewport/resize changes.
  useLayoutEffect(() => {
    paint();
  }, [paint, drawings, refreshKey]);

  useEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;
    const ro = new ResizeObserver(() => paint());
    ro.observe(pane);

    let handler: (() => void) | undefined;
    try {
      handler = () => paint();
      chartRef.current?.timeScale().subscribeVisibleLogicalRangeChange?.(handler);
    } catch {
      /* chart not ready */
    }
    return () => {
      ro.disconnect();
      if (handler) {
        try {
          chartRef.current?.timeScale().unsubscribeVisibleLogicalRangeChange?.(handler);
        } catch {
          /* ignore */
        }
      }
    };
  }, [paint, paneRef, chartRef]);

  // ── Pointer interaction ───────────────────────────────────────────────────
  const localPoint = (e: React.PointerEvent | React.MouseEvent): ScreenPoint => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  function eraseAt(p: ScreenPoint) {
    let bestId: string | null = null;
    let bestDist = ERASER_HIT_PX;
    for (const d of drawingsRef.current) {
      const pts = project(d);
      if (!pts) continue;
      const dist = distanceToShape(p, {
        kind: d.kind,
        points: pts,
        height: d.kind === "text" ? 12 : undefined,
      });
      if (dist <= bestDist) {
        bestDist = dist;
        bestId = d.id;
      }
    }
    if (bestId) {
      commit(drawingsRef.current.filter((d) => d.id !== bestId));
      return;
    }
    // Nothing of ours was hit — let the chart's own price lines take the click.
    onEraseNear?.(p.y);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!capture) return;
    const p = localPoint(e);
    e.currentTarget.setPointerCapture?.(e.pointerId);

    if (activeTool === "eraser") {
      eraseAt(p);
      return;
    }
    if (activeTool === "vline") {
      const c = toChart(p);
      if (c) {
        commit([
          ...drawingsRef.current,
          { id: newDrawingId(), kind: "vline", logical: c.logical, color: DEFAULT_DRAWING_COLOR },
        ]);
      }
      return;
    }
    if (activeTool === "text") {
      setTextPrompt({ at: p, value: "" });
      return;
    }
    if (activeTool === "trend" || activeTool === "rect" || activeTool === "fib") {
      setDraft({ kind: activeTool, from: p, to: p, path: [p] });
      return;
    }
    if (activeTool === "pencil") {
      setDraft({ kind: "pencil", from: p, to: p, path: [p] });
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!draft) return;
    const p = localPoint(e);
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            to: p,
            // Thin the freehand path so a long stroke doesn't bloat storage.
            path:
              prev.kind === "pencil" &&
              Math.hypot(p.x - prev.path[prev.path.length - 1].x, p.y - prev.path[prev.path.length - 1].y) > 2
                ? [...prev.path, p]
                : prev.path,
          }
        : prev,
    );
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!draft) return;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    const d = draft;
    setDraft(null);

    if (d.kind === "pencil") {
      const pts = d.path.map(toChart).filter((p): p is DrawingPoint => p != null);
      if (pts.length >= 2) {
        commit([
          ...drawingsRef.current,
          { id: newDrawingId(), kind: "pencil", points: pts, color: DEFAULT_DRAWING_COLOR },
        ]);
      }
      return;
    }

    // A click without a drag isn't a shape.
    if (Math.hypot(d.to.x - d.from.x, d.to.y - d.from.y) < 4) return;

    const a = toChart(d.from);
    const b = toChart(d.to);
    if (!a || !b) return;
    commit([
      ...drawingsRef.current,
      { id: newDrawingId(), kind: d.kind, a, b, color: DEFAULT_DRAWING_COLOR },
    ]);
  }

  function submitText() {
    if (!textPrompt) return;
    const text = textPrompt.value.trim();
    const at = toChart(textPrompt.at);
    setTextPrompt(null);
    if (!text || !at) return;
    commit([
      ...drawingsRef.current,
      { id: newDrawingId(), kind: "text", at, text, color: DEFAULT_DRAWING_COLOR },
    ]);
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 3,
        }}
      />
      {/* Only intercepts the pointer while a drawing tool is selected, so
          panning, zooming and the crosshair keep working normally. */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDraft(null)}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 4,
          pointerEvents: capture ? "auto" : "none",
          cursor: activeTool === "eraser" ? "cell" : activeTool === "text" ? "text" : "crosshair",
        }}
      />
      {textPrompt && (
        <input
          autoFocus
          value={textPrompt.value}
          onChange={(e) => setTextPrompt({ ...textPrompt, value: e.target.value })}
          onBlur={submitText}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitText();
            if (e.key === "Escape") setTextPrompt(null);
          }}
          placeholder="Note…"
          className="chart-text-input"
          style={{
            left: Math.max(4, textPrompt.at.x),
            top: Math.max(4, textPrompt.at.y - 22),
          }}
        />
      )}
      {(isDrawingTool(activeTool) || activeTool === "eraser") && drawings.length > 0 && (
        <button
          type="button"
          className="chart-clear-drawings"
          onClick={() => commit([])}
          title="Remove every drawing on this chart"
        >
          Clear drawings ({drawings.length})
        </button>
      )}
    </>
  );
}
