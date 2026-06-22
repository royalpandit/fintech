"use client";

import { useCallback, useEffect, useState } from "react";
import AuthGate from "@/components/auth-gate";
import PostComposerModal from "./post-composer-modal";
import PostComposerTrigger from "./post-composer-trigger";
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
}: {
  isAuthed: boolean;
  userName: string;
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

  const load = useCallback(async (cursor?: number) => {
    const isMore = cursor != null;
    if (isMore) setLoadingMore(true);
    else setLoading(true);
    try {
      const data = await fetchSocialPosts({ cursor, limit: 15 });
      setPosts(prev => (isMore ? [...prev, ...data.posts] : data.posts));
      setNextCursor(data.nextCursor);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
      <div className="sf-create-row">
        <AuthGate
          isAuthenticated={isAuthed}
          promptTitle="Sign in to post"
          promptDescription="Share market ideas, charts, and analysis with the community."
        >
          <PostComposerTrigger
            userName={userName}
            onClick={() => setComposerOpen(true)}
          />
        </AuthGate>
      </div>

      <PostComposerModal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onPosted={handlePosted}
        userName={userName}
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
        <p className="sf-feed-empty">Loading community posts…</p>
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
          onClick={() => load(nextCursor)}
          disabled={loadingMore}
        >
          {loadingMore ? "Loading…" : "Load more posts"}
        </button>
      )}
    </div>
  );
}
