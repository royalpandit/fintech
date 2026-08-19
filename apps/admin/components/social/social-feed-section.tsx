"use client";

import { useCallback, useEffect, useState } from "react";
import { FiSearch, FiX, FiPlus } from "react-icons/fi";
import AuthGate from "@/components/auth-gate";
import PostComposerModal from "./post-composer-modal";
import PostEditModal from "./post-edit-modal";
import SocialPostCard from "./social-post-card";
import {
  deleteSocialPost,
  fetchSocialComments,
  fetchSocialPosts,
  postSocialComment,
  reportSocialPost,
  toggleSocialPostLike,
  toggleSocialPostSave,
  updateSocialPost,
} from "@/lib/social-feed-client";
import type { SocialPost } from "@/lib/social-feed-types";
import type { SocialComment } from "@/lib/social-feed-client";

export default function SocialFeedSection({
  isAuthed,
  userName,
  userAvatar = null,
}: {
  isAuthed: boolean;
  userName: string;
  userAvatar?: string | null;
}) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<SocialPost | null>(null);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState<Set<number>>(new Set());
  const [commentsMap, setCommentsMap] = useState<Map<number, SocialComment[]>>(new Map());
  const [commentsLoading, setCommentsLoading] = useState<Set<number>>(new Set());
  const [commentInput, setCommentInput] = useState<Map<number, string>>(new Map());
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const load = useCallback(async (cursor?: number, q?: string) => {
    const isMore = cursor != null;
    if (isMore) setLoadingMore(true);
    else setLoading(true);
    try {
      const data = await fetchSocialPosts({ cursor, limit: 15, q });
      setPosts(prev => (isMore ? [...prev, ...data.posts] : data.posts));
      setNextCursor(data.nextCursor);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Load the feed, and re-run (debounced) whenever the search query changes.
  useEffect(() => {
    const q = search.trim();
    const t = setTimeout(() => load(undefined, q || undefined), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  // Show a freshly created post immediately instead of refetching the whole feed.
  const handlePosted = (post: SocialPost) => {
    setPosts(prev => (prev.some(p => p.id === post.id) ? prev : [post, ...prev]));
  };

  const toggleComments = async (postId: number) => {
    setCommentsOpen(prev => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
    if (!commentsMap.has(postId)) {
      setCommentsLoading(prev => new Set([...prev, postId]));
      const rows = await fetchSocialComments(postId);
      setCommentsMap(prev => new Map([...prev, [postId, rows]]));
      setCommentsLoading(prev => {
        const n = new Set(prev);
        n.delete(postId);
        return n;
      });
    }
  };

  const handleLike = async (post: SocialPost) => {
    if (!isAuthed) return;
    const r = await toggleSocialPostLike(post.id);
    setPosts(prev =>
      prev.map(p =>
        p.id === post.id ? { ...p, liked_by_me: r.liked, like_count: r.count } : p,
      ),
    );
  };

  const handleSave = async (post: SocialPost) => {
    if (!isAuthed) return;
    const r = await toggleSocialPostSave(post.id);
    setPosts(prev =>
      prev.map(p => (p.id === post.id ? { ...p, saved_by_me: r.saved } : p)),
    );
  };

  const handleDelete = async (post: SocialPost) => {
    if (!confirm("Delete this post?")) return;
    await deleteSocialPost(post.id);
    setPosts(prev => prev.filter(p => p.id !== post.id));
  };

  const handleReport = async (post: SocialPost) => {
    const reason = prompt("Report reason:");
    if (!reason?.trim()) return;
    await reportSocialPost(post.id, reason.trim());
    alert("Thanks — we will review this post.");
  };

  const submitComment = async (postId: number) => {
    const text = commentInput.get(postId)?.trim();
    if (!text) return;
    const c = await postSocialComment(postId, text);
    setCommentsMap(prev => {
      const existing = prev.get(postId) ?? [];
      return new Map([...prev, [postId, [...existing, c]]]);
    });
    setCommentInput(prev => new Map([...prev, [postId, ""]]));
    setPosts(prev =>
      prev.map(p => (p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p)),
    );
  };

  return (
    <div className="sf-feed-section">
      {searchOpen ? (
        <div style={{ position: "relative", marginBottom: 14 }}>
          <FiSearch
            size={16}
            style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}
          />
          <input
            type="search"
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search posts — NIFTY, RELIANCE, #Nifty50…"
            aria-label="Search posts"
            style={{
              width: "100%",
              padding: "11px 42px",
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text)",
              fontSize: 14,
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={() => { setSearchOpen(false); setSearch(""); }}
            aria-label="Close search"
            style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "var(--surface-2)", color: "var(--text-muted)", width: 26, height: 26, borderRadius: "50%", display: "grid", placeItems: "center", cursor: "pointer" }}
          >
            <FiX size={15} />
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Search posts"
            title="Search posts"
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 15px", borderRadius: 999, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            <FiSearch size={15} /> Search posts
          </button>
          <AuthGate
            isAuthenticated={isAuthed}
            promptTitle="Sign in to post"
            promptDescription="Share market ideas, charts, and analysis with the community."
          >
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 999, border: "none", background: "var(--primary)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
            >
              <FiPlus size={16} /> Post
            </button>
          </AuthGate>
        </div>
      )}

      <PostComposerModal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onPosted={handlePosted}
        userName={userName}
        userAvatar={userAvatar}
        isAuthed={isAuthed}
      />

      <PostEditModal
        open={editingPost != null}
        initialValue={editingPost?.content ?? ""}
        onCancel={() => setEditingPost(null)}
        onSave={async value => {
          if (!editingPost) return;
          const updated = await updateSocialPost(editingPost.id, { content: value });
          setPosts(prev =>
            prev.map(p =>
              p.id === editingPost.id ? { ...p, content: updated.content } : p,
            ),
          );
          setEditingPost(null);
        }}
      />

      {loading && posts.length === 0 && (
        <p className="sf-feed-empty">
          {search.trim() ? `Searching for “${search.trim()}”…` : "Loading community posts…"}
        </p>
      )}

      {!loading && search.trim() && posts.length === 0 && (
        <p className="sf-feed-empty">No posts found for “{search.trim()}”.</p>
      )}

      <div className="sf-post-list">
        {posts.map(post => (
          <SocialPostCard
            key={post.id}
            post={post}
            isAuthed={isAuthed}
            onLike={() => handleLike(post)}
            onSave={() => handleSave(post)}
            onDelete={() => handleDelete(post)}
            onReport={() => handleReport(post)}
            onEdit={() => setEditingPost(post)}
            comments={commentsMap.get(post.id) ?? []}
            commentsOpen={commentsOpen.has(post.id)}
            onToggleComments={() => toggleComments(post.id)}
            commentInput={commentInput.get(post.id) ?? ""}
            onCommentInput={v => setCommentInput(prev => new Map([...prev, [post.id, v]]))}
            onSubmitComment={() => submitComment(post.id)}
            commentsLoading={commentsLoading.has(post.id)}
          />
        ))}
      </div>

      {nextCursor && (
        <button
          type="button"
          className="sf-load-more"
          onClick={() => load(nextCursor, search.trim() || undefined)}
          disabled={loadingMore}
        >
          {loadingMore ? "Loading…" : "Load more posts"}
        </button>
      )}
    </div>
  );
}
