"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  text: string;
  maxLines?: number;
};

export default function AnalystNoteText({ text, maxLines = 3 }: Props) {
  const noteRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  const measure = useCallback(() => {
    if (expanded) return;
    const el = noteRef.current;
    if (!el) return;
    setOverflows(el.scrollHeight > el.clientHeight + 2);
  }, [expanded]);

  useEffect(() => {
    measure();
    const el = noteRef.current;
    if (!el) return;

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [text, measure]);

  const showToggle = overflows || expanded;

  return (
    <div className="stock-pick-note">
      <p
        ref={noteRef}
        className={`stock-pick-note-text${!expanded ? " stock-pick-note-clamped" : ""}`}
        style={
          !expanded
            ? ({ WebkitLineClamp: maxLines } as Record<string, number>)
            : undefined
        }
      >
        <strong className="stock-pick-note-label">Note: </strong>
        {text}
      </p>
      {showToggle ? (
        <button
          type="button"
          className="stock-pick-note-toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      ) : null}
    </div>
  );
}
