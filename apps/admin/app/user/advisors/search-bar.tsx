"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FiSearch } from "react-icons/fi";
import { PROFESSIONAL_TYPES } from "@/lib/professional-types";

export default function FinanceProSearchBar() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const activeType = params.get("type") ?? "";
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
    if (q === (params.get("q") ?? "")) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => pushParams({ q }), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ position: "relative", marginBottom: 12 }}>
        <FiSearch
          size={16}
          style={{
            position: "absolute",
            left: 14,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-muted)",
          }}
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search analysts, portfolio managers, advisory firms…"
          style={{
            width: "100%",
            height: 46,
            padding: "0 14px 0 40px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text)",
            fontSize: 14,
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <TypePill label="All" active={!activeType} onClick={() => pushParams({ type: "" })} />
        {PROFESSIONAL_TYPES.map((t) => (
          <TypePill
            key={t.value}
            label={t.label}
            active={activeType === t.value}
            onClick={() => pushParams({ type: activeType === t.value ? "" : t.value })}
          />
        ))}
      </div>
    </div>
  );
}

function TypePill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "7px 14px",
        borderRadius: 999,
        border: `1px solid ${active ? "transparent" : "var(--border)"}`,
        background: active ? "#0ea5e9" : "var(--surface)",
        color: active ? "#fff" : "var(--text)",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}
