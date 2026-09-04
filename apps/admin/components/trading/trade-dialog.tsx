"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { placePaperOrder, type PaperOrderType } from "@/lib/paper-trade-client";
import { useToast } from "@/components/toast";

/**
 * Place a paper trade without leaving the page.
 *
 * Anchored under the button you clicked, not centred over a dimmed page. A
 * one-line order does not warrant the whole screen: the backdrop hid the quote
 * you were reacting to, and on a list of movers the price and change you just
 * read are the context you want kept while you size the order. Nothing behind
 * it is disabled either — clicking another row just moves the popover.
 *
 * It posts through placePaperOrder, the same client the full Virtual Trading
 * form uses, so there is still one order path (lib/paper-order-engine.ts) with
 * one set of validation, balance checks and rejection messages.
 */

const PANEL_W = 300;
const GAP = 8;
const MARGIN = 12;

/** Below this there is no "beside" to anchor to — use a bottom sheet. */
const SHEET_BREAKPOINT = 560;

const inr = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function TradeDialog({
  symbol,
  side: initialSide,
  price,
  exchange,
  anchor,
  onClose,
}: {
  symbol: string;
  side: "buy" | "sell";
  /** Last traded price, when the caller already has it — drives the estimate
   *  without another quote request. */
  price?: number | null;
  exchange?: string | null;
  anchor?: HTMLElement | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const panelRef = useRef<HTMLDivElement>(null);

  const [side, setSide] = useState<"buy" | "sell">(initialSide);
  const [qty, setQty] = useState(1);
  const [orderType, setOrderType] = useState<PaperOrderType>("MARKET");
  const [limitPrice, setLimitPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const [sheet, setSheet] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const place = useCallback(() => {
    if (typeof window === "undefined") return;

    const asSheet = window.innerWidth <= SHEET_BREAKPOINT || !anchor;
    setSheet(asSheet);
    if (asSheet) return;

    const a = anchor.getBoundingClientRect();

    // Anchor scrolled out of view — nothing left to point at. Horizontal
    // counts too: the ETF and mutual-fund tables scroll sideways inside their
    // own container, so a row can leave the screen without the page moving.
    if (
      a.bottom < 0 ||
      a.top > window.innerHeight ||
      a.right < 0 ||
      a.left > window.innerWidth
    ) {
      onClose();
      return;
    }

    const h = panelRef.current?.offsetHeight ?? 300;

    /*
     * Directly under the button, right edges aligned.
     *
     * An earlier version sat to the RIGHT of the whole button group, which in a
     * three-column layout put the panel over the next panel entirely — visually
     * detached from the row that opened it. Below-and-aligned keeps it touching
     * its own row, and flips above when there is no room underneath.
     */
    let left = a.right - PANEL_W;
    left = Math.max(MARGIN, Math.min(left, window.innerWidth - PANEL_W - MARGIN));

    let top = a.bottom + GAP;
    if (top + h + MARGIN > window.innerHeight) {
      const above = a.top - h - GAP;
      top = above >= MARGIN ? above : Math.max(MARGIN, window.innerHeight - h - MARGIN);
    }

    setPos({ top, left });
  }, [anchor, onClose]);

  useLayoutEffect(place, [place, orderType, error, done]);

  // Capture phase: these lists scroll inside .us-main, not the window, and a
  // bubbling listener never sees those.
  useEffect(() => {
    const onMove = () => place();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [place]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      // A click on the anchor is the toggle — let its own handler decide.
      if (anchor?.contains(t)) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [onClose, anchor]);

  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>(".td-qty-input")?.focus();
  }, []);

  const sym = symbol.trim().toUpperCase();
  const unit = orderType === "LIMIT" ? Number(limitPrice) || 0 : price ?? 0;
  const estimate = unit > 0 ? unit * qty : null;

  async function submit() {
    setError("");
    setDone("");
    if (!Number.isFinite(qty) || qty <= 0) return setError("Quantity must be at least 1.");
    if (orderType === "LIMIT" && !(Number(limitPrice) > 0)) {
      return setError("Enter a limit price.");
    }

    setBusy(true);
    try {
      const res = await placePaperOrder({
        symbol: sym,
        side,
        orderType,
        quantity: qty,
        limitPrice: orderType === "LIMIT" ? Number(limitPrice) : undefined,
        exchange: exchange ?? undefined,
      });
      if (!res.ok) {
        setError(res.text);
        toast.show(res.text, "error");
        return;
      }

      /*
       * Confirm in two places, on purpose.
       *
       * The toast is the immediate acknowledgement and outlives this popover,
       * which closes a moment later — without it a successful order would flash
       * and vanish with nothing to show it happened. The server separately
       * writes a notification (notifyPaperOrder in the orders route), so the
       * fill is still there in the bell afterwards. Rejections get the same
       * treatment: the toast says it now, the notification keeps the reason.
       */
      const filled = res.executed
        ? `${side === "buy" ? "Bought" : "Sold"} ${qty} ${sym}`
        : `${side === "buy" ? "Buy" : "Sell"} order placed for ${qty} ${sym}`;
      toast.show(filled, "success");

      setDone(res.text);
      // Holdings and balance elsewhere on the page are now stale.
      router.refresh();
      setTimeout(onClose, 900);
    } catch {
      const msg = "Could not place the order — sign in to use paper trading.";
      setError(msg);
      toast.show(msg, "error");
    } finally {
      setBusy(false);
    }
  }

  /*
   * Two things keep this on screen.
   *
   * The portal: the popover is rendered from inside a table cell, and any
   * ancestor with a transform, filter or `contain` turns itself into the
   * containing block for `position: fixed` descendants — at which point the
   * viewport clamp below is computed against the wrong box. Mounting on <body>
   * means "fixed" always means the viewport, whatever the row sits inside.
   *
   * The visibility gate: until `place()` has run there is no top/left, and a
   * fixed element with no offsets falls back to its STATIC position — inside
   * the row, hard against the right edge, overflowing the screen. That is what
   * the ETF table was showing. Laying it out while invisible costs one frame
   * and removes the possibility of ever painting it in the wrong place.
   */
  const body = (
    <div
      ref={panelRef}
      className={`td-pop${sheet ? " td-pop--sheet" : ""}`}
      style={
        sheet
          ? undefined
          : pos
            ? { top: pos.top, left: pos.left }
            : { top: 0, left: 0, visibility: "hidden" }
      }
      role="dialog"
      aria-label={`${side === "buy" ? "Buy" : "Sell"} ${sym} with virtual funds`}
    >
      <div className="td-head">
        <div className="td-head-id">
          <div className="td-sym">{sym}</div>
          {/* Stated every time: this sits beside live NSE prices and none of it
              is real money. */}
          <div className="td-note">Paper trade · virtual funds</div>
        </div>
        {price != null && price > 0 && <div className="td-ltp">₹{inr(price)}</div>}
        <button type="button" className="td-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <div className="td-body">
        {/* Side is switchable here rather than forcing a close-and-reopen when
            you hit the wrong button. */}
        <div className="td-sides" role="group" aria-label="Side">
          <button
            type="button"
            className={`td-sidebtn td-sidebtn--buy${side === "buy" ? " is-active" : ""}`}
            onClick={() => setSide("buy")}
          >
            Buy
          </button>
          <button
            type="button"
            className={`td-sidebtn td-sidebtn--sell${side === "sell" ? " is-active" : ""}`}
            onClick={() => setSide("sell")}
          >
            Sell
          </button>
        </div>

        <label className="td-label" htmlFor="td-qty">
          Quantity
        </label>
        <div className="td-stepper">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            aria-label="Decrease quantity"
          >
            −
          </button>
          <input
            id="td-qty"
            className="td-qty-input"
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
          />
          <button type="button" onClick={() => setQty((q) => q + 1)} aria-label="Increase quantity">
            +
          </button>
        </div>

        <label className="td-label" htmlFor="td-type">
          Order type
        </label>
        <select
          id="td-type"
          className="td-select"
          value={orderType}
          onChange={(e) => setOrderType(e.target.value as PaperOrderType)}
        >
          <option value="MARKET">Market (live price)</option>
          <option value="LIMIT">Limit</option>
        </select>

        {orderType === "LIMIT" && (
          <>
            <label className="td-label" htmlFor="td-limit">
              Limit price
            </label>
            <input
              id="td-limit"
              className="td-select"
              type="number"
              min={0}
              step="0.05"
              placeholder="0.00"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
            />
          </>
        )}

        {estimate != null && (
          <div className="td-estimate">
            <span>Estimated {side === "buy" ? "cost" : "proceeds"}</span>
            <strong>₹{inr(estimate)}</strong>
          </div>
        )}

        {error && <p className="td-msg td-msg--error">{error}</p>}
        {done && <p className="td-msg td-msg--ok">{done}</p>}

        <button
          type="button"
          className={`td-submit td-submit--${side}`}
          onClick={() => void submit()}
          disabled={busy}
        >
          {busy ? "Placing…" : `${side === "buy" ? "Buy" : "Sell"} ${qty} ${sym}`}
        </button>
      </div>
    </div>
  );

  // SSR has no document; the popover only ever opens from a click anyway.
  return typeof document === "undefined" ? body : createPortal(body, document.body);
}
