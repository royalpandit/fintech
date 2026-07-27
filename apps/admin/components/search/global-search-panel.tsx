"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FiSearch, FiArrowLeft, FiX } from "react-icons/fi";
import { professionalTypeLabel } from "@/lib/professional-types";

type Advisor = { id: number; name: string; sub: string; professionalType: string | null };
type Post = { id: number; title: string; sub: string; sentiment: string };
type Course = { id: number; title: string };
type Community = { slug: string; name: string; type: string };

type Results = {
  advisors: Advisor[];
  posts: Post[];
  courses: Course[];
  communities: Community[];
};

const EMPTY: Results = { advisors: [], posts: [], courses: [], communities: [] };

type TabId = "all" | "advisors" | "posts" | "courses" | "communities";

const TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "advisors", label: "Professionals" },
  { id: "posts", label: "Posts" },
  { id: "courses", label: "Courses" },
  { id: "communities", label: "Communities" },
];

export default function GlobalSearchPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<TabId>("all");
  const [results, setResults] = useState<Results>(EMPTY);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Debounced fetch
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(term)}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!cancelled) {
          setResults({
            advisors: json.advisors ?? [],
            posts: json.posts ?? [],
            courses: json.courses ?? [],
            communities: json.communities ?? [],
          });
        }
      } catch {
        if (!cancelled) setResults(EMPTY);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const counts = useMemo(
    () => ({
      advisors: results.advisors.length,
      posts: results.posts.length,
      courses: results.courses.length,
      communities: results.communities.length,
    }),
    [results],
  );
  const total = counts.advisors + counts.posts + counts.courses + counts.communities;
  const show = (key: Exclude<TabId, "all">) => tab === "all" || tab === key;

  return (
    <div className="gs-overlay" role="dialog" aria-label="Search" onClick={onClose}>
      <div className="gs-panel" onClick={(e) => e.stopPropagation()}>
        {/* Search bar */}
        <div className="gs-bar">
          <button type="button" className="gs-back" onClick={onClose} aria-label="Close search">
            <FiArrowLeft size={18} />
          </button>
          <FiSearch size={16} className="gs-bar-icon" />
          <input
            ref={inputRef}
            className="gs-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search professionals, posts, courses, communities…"
            onKeyDown={(e) => {
              if (e.key === "Enter" && q.trim()) {
                go(`/user/search?q=${encodeURIComponent(q.trim())}`);
              }
            }}
          />
          {q && (
            <button type="button" className="gs-clear" onClick={() => setQ("")} aria-label="Clear">
              <FiX size={16} />
            </button>
          )}
        </div>

        {/* Category tabs */}
        <div className="gs-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`gs-tab${tab === t.id ? " gs-tab-active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Results */}
        <div className="gs-results">
          {q.trim().length < 2 ? (
            <p className="gs-hint">Type at least 2 characters to search.</p>
          ) : loading ? (
            <p className="gs-hint">Searching…</p>
          ) : total === 0 ? (
            <p className="gs-hint">No results for &quot;{q.trim()}&quot;.</p>
          ) : (
            <>
              {show("advisors") && counts.advisors > 0 && (
                <section className="gs-group">
                  <h4 className="gs-group-title">Finance Professionals</h4>
                  {results.advisors.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className="gs-row"
                      onClick={() => go(`/user/advisors/${a.id}`)}
                    >
                      <span className="gs-avatar">{a.name.slice(0, 2).toUpperCase()}</span>
                      <span className="gs-row-main">
                        <span className="gs-row-title">{a.name}</span>
                        <span className="gs-row-sub">
                          {professionalTypeLabel(a.professionalType)}
                          {a.sub ? ` · ${a.sub}` : ""}
                        </span>
                      </span>
                    </button>
                  ))}
                </section>
              )}

              {show("posts") && counts.posts > 0 && (
                <section className="gs-group">
                  <h4 className="gs-group-title">Posts</h4>
                  {results.posts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="gs-row"
                      onClick={() => go(`/user/markets/${p.id}`)}
                    >
                      <span className="gs-row-main">
                        <span className="gs-row-title">{p.title}</span>
                        <span className="gs-row-sub">
                          {p.sub ? `${p.sub} · ` : ""}
                          {p.sentiment}
                        </span>
                      </span>
                    </button>
                  ))}
                </section>
              )}

              {show("courses") && counts.courses > 0 && (
                <section className="gs-group">
                  <h4 className="gs-group-title">Courses</h4>
                  {results.courses.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="gs-row"
                      onClick={() => go(`/user/courses/${c.id}`)}
                    >
                      <span className="gs-row-main">
                        <span className="gs-row-title">{c.title}</span>
                      </span>
                    </button>
                  ))}
                </section>
              )}

              {show("communities") && counts.communities > 0 && (
                <section className="gs-group">
                  <h4 className="gs-group-title">Communities</h4>
                  {results.communities.map((g) => (
                    <button
                      key={g.slug}
                      type="button"
                      className="gs-row"
                      onClick={() => go(`/user/community/${g.slug}`)}
                    >
                      <span className="gs-row-main">
                        <span className="gs-row-title">{g.name}</span>
                        <span className="gs-row-sub">{g.type}</span>
                      </span>
                    </button>
                  ))}
                </section>
              )}
            </>
          )}
        </div>

        {q.trim() && (
          <button
            type="button"
            className="gs-seeall"
            onClick={() => go(`/user/search?q=${encodeURIComponent(q.trim())}`)}
          >
            See all results for &quot;{q.trim()}&quot;
          </button>
        )}
      </div>
    </div>
  );
}
