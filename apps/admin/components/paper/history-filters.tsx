"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

const MONTHS = (() => {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({
      value,
      label: d.toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
    });
  }
  return out;
})();

export default function HistoryFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const type = params.get("type") ?? "virtual";
  const month = params.get("month") ?? "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";

  const buildHref = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const q = next.toString();
    return `/user/history${q ? `?${q}` : ""}`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[
          { key: "virtual", label: "Paper trades" },
          { key: "real", label: "Broker trades" },
          { key: "all", label: "All" },
        ].map((t) => (
          <Link
            key={t.key}
            href={buildHref({ type: t.key })}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: type === t.key ? "#fff" : "var(--text-muted)",
              background: type === t.key ? "#0ea5e9" : "var(--surface)",
              border: "1px solid var(--border)",
              textDecoration: "none",
            }}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "flex-end",
          padding: 14,
          background: "var(--surface-2)",
          borderRadius: 12,
          border: "1px solid var(--border)",
        }}
      >
        <div>
          <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
            Month
          </label>
          <select
            value={month}
            onChange={(e) => router.push(buildHref({ month: e.target.value || null, from: null, to: null }))}
            style={{
              height: 36,
              padding: "0 10px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              fontSize: 12,
              minWidth: 140,
            }}
          >
            <option value="">All months</option>
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
            From
          </label>
          <input
            type="date"
            value={from}
            onChange={(e) =>
              router.push(buildHref({ from: e.target.value || null, month: null }))
            }
            style={{
              height: 36,
              padding: "0 10px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              fontSize: 12,
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
            To
          </label>
          <input
            type="date"
            value={to}
            onChange={(e) => router.push(buildHref({ to: e.target.value || null, month: null }))}
            style={{
              height: 36,
              padding: "0 10px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              fontSize: 12,
            }}
          />
        </div>
        {(month || from || to) && (
          <Link
            href={buildHref({ month: null, from: null, to: null })}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-muted)",
              textDecoration: "none",
              border: "1px solid var(--border)",
              background: "var(--surface)",
            }}
          >
            Clear dates
          </Link>
        )}
      </div>
    </div>
  );
}
