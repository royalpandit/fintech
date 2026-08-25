"use client";

import { useEffect, useRef } from "react";

/**
 * Standard dismiss behaviour for a popover / dropdown: clicking anywhere
 * outside it closes it, and Escape closes it and returns focus to the button
 * that opened it (so keyboard users don't get dumped at the top of the page).
 *
 * Returns two refs — put `containerRef` on the wrapper that holds both the
 * trigger and the panel, and `triggerRef` on the trigger button.
 *
 *   const { containerRef, triggerRef } = useDismissableMenu(open, () => setOpen(false));
 *
 * The listeners are only attached while `open` is true, so a closed menu costs
 * nothing and Escape stays available to whatever else wants it.
 */
export function useDismissableMenu<
  C extends HTMLElement = HTMLDivElement,
  T extends HTMLElement = HTMLButtonElement,
>(open: boolean, onClose: () => void) {
  const containerRef = useRef<C | null>(null);
  const triggerRef = useRef<T | null>(null);

  // Keep the latest callback without re-attaching listeners every render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onCloseRef.current();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onCloseRef.current();
      triggerRef.current?.focus();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    // Capture phase so the menu wins over an outer Escape handler (e.g. the
    // mobile nav drawer) instead of both firing on one keypress.
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  return { containerRef, triggerRef };
}
