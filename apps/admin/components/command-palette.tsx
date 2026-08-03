"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MODULE_ROUTE_MAP, NAV_GROUPS } from "../lib/super-admin";

type Item = {
  key: string;
  label: string;
  sub?: string;
  group: string;
  href: string;
};

const PAGE_COMMANDS: Item[] = [
  ...NAV_GROUPS.flatMap((g) =>
    g.modules
      .filter((m) => MODULE_ROUTE_MAP[m])
      .map((m) => ({
        key: `page-${m}`,
        label: m,
        sub: "Go to",
        group: "Pages",
        href: MODULE_ROUTE_MAP[m],
      })),
  ),
  { key: "act-create-user", label: "Create new user", sub: "Action", group: "Pages", href: "/super-admin/users/create" },
];

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [remote, setRemote] = useState<Item[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global ⌘K / Ctrl-K to open, Esc to close.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setRemote([]);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  // Live search against the admin search endpoint.
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setRemote([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/admin/search?q=${encodeURIComponent(query)}`);
        const j = await res.json();
        const items: Item[] = [
          ...(j.users ?? []).map((u: { id: number; name: string; sub: string; role: string }) => ({
            key: `u-${u.id}`,
            label: u.name,
            sub: `${u.sub} · ${u.role}`,
            group: "Users",
            href: `/super-admin/users?q=${encodeURIComponent(u.sub || u.name)}`,
          })),
          ...(j.advisors ?? []).map((a: { id: number; name: string; sub: string }) => ({
            key: `a-${a.id}`,
            label: a.name,
            sub: a.sub,
            group: "Advisors",
            href: `/super-admin/advisors/${a.id}`,
          })),
          ...(j.posts ?? []).map((p: { id: number; title: string; sub: string; status: string }) => ({
            key: `p-${p.id}`,
            label: p.title,
            sub: `${p.sub || "post"} · ${p.status}`,
            group: "Posts",
            href: `/super-admin/market-posts/${p.id}`,
          })),
          ...(j.courses ?? []).map((c: { id: number; title: string }) => ({
            key: `c-${c.id}`,
            label: c.title,
            sub: "Course",
            group: "Courses",
            href: `/super-admin/courses`,
          })),
          ...(j.communities ?? []).map((g: { slug: string; name: string }) => ({
            key: `g-${g.slug}`,
            label: g.name,
            sub: "Community",
            group: "Communities",
            href: `/super-admin/community`,
          })),
        ];
        setRemote(items);
      } catch {
        setRemote([]);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const items = useMemo(() => {
    const query = q.trim().toLowerCase();
    const pages = query
      ? PAGE_COMMANDS.filter((c) => c.label.toLowerCase().includes(query))
      : PAGE_COMMANDS;
    return [...pages, ...remote];
  }, [q, remote]);

  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, items.length - 1)));
  }, [items.length]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  function onListKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = items[active];
      if (it) go(it.href);
    }
  }

  // Group items for display while keeping a flat index for keyboard nav.
  let flatIndex = -1;
  const grouped: { group: string; rows: { item: Item; index: number }[] }[] = [];
  for (const item of items) {
    flatIndex++;
    const last = grouped[grouped.length - 1];
    if (last && last.group === item.group) last.rows.push({ item, index: flatIndex });
    else grouped.push({ group: item.group, rows: [{ item, index: flatIndex }] });
  }

  return (
    <>
      {/* Header trigger — looks like a search field, opens the palette */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          height: 40,
          padding: "0 12px 0 14px",
          borderRadius: 10,
          border: "1px solid var(--border)",
          background: "var(--surface-2)",
          color: "var(--text-muted)",
          fontSize: 13,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span style={{ flex: 1 }}>Search across the platform…</span>
        <kbd
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "2px 7px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text-muted)",
          }}
        >
          ⌘K
        </kbd>
      </button>

      {open && (
        <div
          onMouseDown={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.4)",
            zIndex: 300,
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            paddingTop: "12vh",
          }}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 560,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              boxShadow: "0 24px 60px rgba(15,23,42,0.3)",
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: "var(--text-muted)" }}>
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onListKey}
                placeholder="Search users, advisors, posts, pages…"
                style={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontSize: 15,
                  color: "var(--text)",
                }}
              />
              <kbd
                style={{
                  fontSize: 11,
                  padding: "2px 7px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  color: "var(--text-muted)",
                }}
              >
                Esc
              </kbd>
            </div>

            <div style={{ maxHeight: 400, overflowY: "auto", padding: 6 }}>
              {items.length === 0 ? (
                <p style={{ padding: "18px 12px", fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
                  No matches.
                </p>
              ) : (
                grouped.map((section) => (
                  <div key={section.group}>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: 0.8,
                        textTransform: "uppercase",
                        color: "var(--text-muted)",
                        padding: "8px 12px 4px",
                      }}
                    >
                      {section.group}
                    </div>
                    {section.rows.map(({ item, index }) => (
                      <button
                        key={item.key}
                        type="button"
                        onMouseEnter={() => setActive(index)}
                        onClick={() => go(item.href)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          width: "100%",
                          textAlign: "left",
                          padding: "9px 12px",
                          borderRadius: 8,
                          border: "none",
                          background: index === active ? "var(--primary-soft)" : "transparent",
                          color: "var(--text)",
                          cursor: "pointer",
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 600, flexShrink: 0 }}>{item.label}</span>
                        {item.sub && (
                          <span style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.sub}
                          </span>
                        )}
                        {index === active && (
                          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>↵</span>
                        )}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
