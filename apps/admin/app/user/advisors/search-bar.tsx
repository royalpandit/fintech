"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FiSearch, FiX } from "react-icons/fi";
import { PROFESSIONAL_TYPES } from "@/lib/professional-types";

export default function FinanceProSearchBar() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const activeType = params.get("type") ?? "";
  const urlQ = params.get("q") ?? "";
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Push the current query/type into the URL so the server component re-filters.
  const pushParams = (next: { q?: string; type?: string }) => {
    const sp = new URLSearchParams(params.toString());
    const nextQ = next.q ?? q;
    const nextType = next.type ?? activeType;
    if (nextQ.trim()) sp.set("q", nextQ.trim());
    else sp.delete("q");
    if (nextType) sp.set("type", nextType);
    else sp.delete("type");
    const query = sp.toString();
    router.push(query ? `/user/advisors?${query}` : "/user/advisors");
  };

  // Debounce text input so we don't navigate on every keystroke.
  useEffect(() => {
    if (q === urlQ) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => pushParams({ q }), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Keep the box in sync when the URL changes from elsewhere (back button, a
  // "clear filters" link in the empty state).
  useEffect(() => {
    setQ(urlQ);
  }, [urlQ]);

  const hasFilters = Boolean(q.trim() || activeType);

  return (
    <div style={{ marginBottom: 20 }}>
      <div className="fp-search">
        <FiSearch size={17} className="fp-search-icon" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search analysts, portfolio managers, advisory firms…"
          aria-label="Search finance professionals"
        />
        {q && (
          <button
            type="button"
            className="fp-search-clear"
            onClick={() => setQ("")}
            aria-label="Clear search"
          >
            <FiX size={14} />
          </button>
        )}
      </div>

      <div className="fp-pills">
        <button
          type="button"
          className={`fp-pill${activeType ? "" : " active"}`}
          onClick={() => pushParams({ type: "" })}
        >
          All
        </button>
        {PROFESSIONAL_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            className={`fp-pill${activeType === t.value ? " active" : ""}`}
            onClick={() => pushParams({ type: activeType === t.value ? "" : t.value })}
          >
            {t.label}
          </button>
        ))}
        {hasFilters && (
          <button
            type="button"
            className="fp-pill fp-pill-reset"
            onClick={() => {
              setQ("");
              router.push("/user/advisors");
            }}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
