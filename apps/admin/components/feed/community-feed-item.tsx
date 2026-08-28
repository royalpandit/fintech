"use client";

import { useState } from "react";
import SocialPostCard from "@/components/social/social-post-card";
import PostEditModal from "@/components/social/post-edit-modal";
import {
  deleteSocialPost,
  fetchSocialComments,
  postSocialComment,
  reportSocialPost,
  toggleSocialPostLike,
  toggleSocialPostSave,
  updateSocialPost,
  type SocialComment,
} from "@/lib/social-feed-client";
import type { SocialPost } from "@/lib/social-feed-types";

/**
 * One community post inside the merged feed.
 *
 * The old Community tab kept like / save / comment state for the whole page in
 * SocialFeedSection. In a merged stream that state would have to be hoisted
 * into FeedClient alongside the advisor-post state it already carries — two
 * parallel sets of maps keyed by ids from different tables, which is exactly
 * how you end up liking the wrong post. Each card owns its own interaction
 * state instead; the feed just renders it and forgets about it.
 */
export default function CommunityFeedItem({
  post: initialPost,
  isAuthed,
  onRemoved,
}: {
  post: SocialPost;
  isAuthed: boolean;
  /** Lets the feed drop the row when the author deletes their own post. */
  onRemoved?: (id: number) => void;
}) {
  const [post, setPost] = useState<SocialPost>(initialPost);
  const [editing, setEditing] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<SocialComment[] | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentInput, setCommentInput] = useState("");

  async function toggleComments() {
    const opening = !commentsOpen;
    setCommentsOpen(opening);
    if (opening && comments === null) {
      setCommentsLoading(true);
      try {
        setComments(await fetchSocialComments(post.id));
      } finally {
        setCommentsLoading(false);
      }
    }
  }

  async function handleLike() {
    if (!isAuthed) return;
    // Optimistic, then reconciled with the server's authoritative count.
    setPost((p) => ({
      ...p,
      liked_by_me: !p.liked_by_me,
      like_count: p.like_count + (p.liked_by_me ? -1 : 1),
    }));
    try {
      const r = await toggleSocialPostLike(post.id);
      setPost((p) => ({ ...p, liked_by_me: r.liked, like_count: r.count }));
    } catch {
      setPost((p) => ({
        ...p,
        liked_by_me: initialPost.liked_by_me,
        like_count: initialPost.like_count,
      }));
    }
  }

  async function handleSave() {
    if (!isAuthed) return;
    const r = await toggleSocialPostSave(post.id);
    setPost((p) => ({ ...p, saved_by_me: r.saved }));
  }

  async function handleDelete() {
    if (!confirm("Delete this post?")) return;
    await deleteSocialPost(post.id);
    onRemoved?.(post.id);
  }

  async function handleReport() {
    const reason = prompt("Report reason:");
    if (!reason?.trim()) return;
    await reportSocialPost(post.id, reason.trim());
    alert("Thanks — we will review this post.");
  }

  async function submitComment() {
    const text = commentInput.trim();
    if (!text) return;
    const c = await postSocialComment(post.id, text);
    setComments((prev) => [...(prev ?? []), c]);
    setCommentInput("");
    setPost((p) => ({ ...p, comment_count: p.comment_count + 1 }));
  }

  return (
    <>
      <SocialPostCard
        post={post}
        isAuthed={isAuthed}
        onLike={handleLike}
        onSave={handleSave}
        onDelete={handleDelete}
        onReport={handleReport}
        onEdit={() => setEditing(true)}
        comments={comments ?? []}
        commentsOpen={commentsOpen}
        onToggleComments={toggleComments}
        commentInput={commentInput}
        onCommentInput={setCommentInput}
        onSubmitComment={submitComment}
        commentsLoading={commentsLoading}
      />

      <PostEditModal
        open={editing}
        initialValue={post.content}
        onCancel={() => setEditing(false)}
        onSave={async (value) => {
          const updated = await updateSocialPost(post.id, { content: value });
          setPost((p) => ({ ...p, content: updated.content }));
          setEditing(false);
        }}
      />
    </>
  );
}
