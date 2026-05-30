"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FiPlus, FiSearch } from "react-icons/fi";
import CommunityCard from "@/components/community/community-card";
import {
  fetchCommunities,
  searchCommunities,
  type CommunityTab,
  type CommunitySort,
} from "@/lib/community-client";
import type { SerializedCommunity } from "@/lib/community";

const TABS: { id: CommunityTab; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "popular", label: "Popular" },
  { id: "joined", label: "Joined" },
  { id: "mine", label: "My Communities" },
];

const SORTS: { id: CommunitySort; label: string }[] = [
  { id: "latest", label: "Latest" },
  { id: "trending", label: "Trending" },
];

export default function CommunityHubClient({ isAuthed }: { isAuthed: boolean }) {
  const [tab, setTab] = useState<CommunityTab>("home");
  const [sort, setSort] = useState<CommunitySort>("latest");
  const [typeFilter, setTypeFilter] = useState<"" | "public" | "private">("");
  const [query, setQuery] = useState("");
  const [communities, setCommunities] = useState<SerializedCommunity[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<SerializedCommunity[] | null>(null);

  const load = useCallback(
    async (reset = false) => {
      setLoading(true);
      try {
        if (query.trim()) {
          const data = await searchCommunities(query.trim(), typeFilter || undefined);
          setSearchResults(data.communities);
          setCommunities(data.communities);
          setCursor(null);
        } else {
          setSearchResults(null);
          const data = await fetchCommunities({
            tab,
            sort: tab === "popular" ? "trending" : sort,
            type: typeFilter || undefined,
            cursor: reset ? undefined : cursor ?? undefined,
          });
          setCommunities((prev) => (reset ? data.communities : [...prev, ...data.communities]));
          setCursor(data.next_cursor);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    },
    [tab, sort, typeFilter, query, cursor],
  );

  useEffect(() => {
    setCommunities([]);
    setCursor(null);
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, sort, typeFilter, query]);

  return (
    <div className="comm-hub">
      <div className="comm-hub-top">
        <div>
          <h1 className="comm-hub-title">Communities</h1>
          <p className="comm-hub-sub">Discover and join Reddit-style finance communities</p>
        </div>
        {isAuthed ? (
          <Link href="/user/community/create" className="comm-btn comm-btn-primary">
            <FiPlus size={14} /> Create Community
          </Link>
        ) : null}
      </div>

      <div className="comm-search-bar">
        <FiSearch size={16} />
        <input
          type="search"
          placeholder="Search communities, posts, users..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {!searchResults && (
        <>
          <div className="comm-tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`comm-tab ${tab === t.id ? "comm-tab-active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="comm-filters">
            {SORTS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`comm-filter ${sort === s.id ? "comm-filter-active" : ""}`}
                onClick={() => setSort(s.id)}
              >
                {s.label}
              </button>
            ))}
            <select
              className="comm-select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as "" | "public" | "private")}
            >
              <option value="">All types</option>
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </div>
        </>
      )}

      <div className="comm-grid">
        {communities.map((c) => (
          <CommunityCard key={c.slug} community={c} />
        ))}
      </div>

      {loading && <p className="comm-loading">Loading...</p>}
      {!loading && communities.length === 0 && (
        <div className="comm-empty">
          <p>No communities found.</p>
          {isAuthed && tab === "mine" ? (
            <Link href="/user/community/create">Create your first community</Link>
          ) : null}
        </div>
      )}

      {!loading && cursor && !query && (
        <button type="button" className="comm-load-more" onClick={() => void load(false)}>
          Load more
        </button>
      )}
    </div>
  );
}
