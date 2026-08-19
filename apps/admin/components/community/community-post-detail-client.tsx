"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiHeart, FiShare2, FiArrowLeft, FiBookmark } from "react-icons/fi";
import { useToast } from "@/components/toast";
// import CommentThread from "@/components/community/comment-thread"; // comments hidden for now
import {
  likeCommunityPost,
  shareCommunityPost,
  pinCommunityPost,
} from "@/lib/community-client";
import type { SocialPost } from "@/lib/social-feed-types";
import type { CommunityComment } from "@/lib/community-client";
import { formatRelativeTime } from "@/lib/format-date";
import CommunityPostImages from "@/components/community/community-post-images";

export default function CommunityPostDetailClient({
  slug,
  communityName,
  post: initialPost,
  comments: initialComments,
  canInteract,
  canModerate,
  linkUrl,
  initialPinned = false,
}: {
  slug: string;
  communityName: string;
  post: SocialPost;
  comments: CommunityComment[];
  canInteract: boolean;
  canModerate: boolean;
  linkUrl?: string | null;
  initialPinned?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [post, setPost] = useState(initialPost);
  const [pinned, setPinned] = useState(initialPinned);
  const [busy, setBusy] = useState<"like" | "share" | "pin" | null>(null);

  // These were fire-and-forget (`void fn()`), so any rejection — a 403, a
  // network blip — vanished and the UI simply didn't move.
  async function toggleLike() {
    if (busy) return;
    setBusy("like");
    try {
      const data = await likeCommunityPost(slug, post.id);
      setPost((p) => ({ ...p, liked_by_me: data.liked, like_count: data.like_count }));
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Couldn't update your like", "error");
    } finally {
      setBusy(null);
    }
  }

  async function onShare() {
    if (busy) return;
    setBusy("share");
    const url = window.location.href;
    try {
      const data = await shareCommunityPost(slug, post.id);
      setPost((p) => ({ ...p, share_count: data.share_count }));

      // Open the OS share sheet where there is one; fall back to the clipboard.
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({ title: post.title ?? "Community post", url });
          return;
        } catch (e) {
          // Dismissing the sheet isn't a failure — don't then copy.
          if (e instanceof DOMException && e.name === "AbortError") return;
        }
      }
      await navigator.clipboard?.writeText(url);
      toast.show("Link copied", "success");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Couldn't share this post", "error");
    } finally {
      setBusy(null);
    }
  }

  async function onPin() {
    if (busy) return;
    setBusy("pin");
    try {
      const data = await pinCommunityPost(slug, post.id);
      // The page showed no pinned state at all, so a successful pin looked
      // exactly like a no-op. Reflect it immediately.
      setPinned(data.pinned);
      toast.show(data.pinned ? "Post pinned" : "Post unpinned", "success");
      router.refresh();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Couldn't pin this post", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="comm-post-detail">
      <Link href={`/user/community/${slug}`} className="comm-back-link">
        <FiArrowLeft size={14} /> Back to {communityName}
      </Link>

      <article className="comm-post-full">
        {pinned && (
          <span className="comm-pinned-badge">
            <FiBookmark size={11} /> Pinned
          </span>
        )}
        <div className="comm-post-meta">
          <span>{post.user.fullName}</span>
          <span>·</span>
          <span>{formatRelativeTime(post.created_at)}</span>
        </div>
        {post.title ? <h1>{post.title}</h1> : null}
        <div className="comm-post-body">{post.content}</div>
        {post.images?.length ? (
          <CommunityPostImages images={post.images.map((i) => ({ id: i.id, url: i.url }))} />
        ) : null}
        {linkUrl ? (
          <a href={linkUrl} target="_blank" rel="noreferrer" className="comm-link-preview">
            {linkUrl}
          </a>
        ) : null}

        {!canInteract && (
          <p className="comm-join-hint">
            <Link href={`/user/community/${slug}`}>Join {communityName}</Link> to like,
            share or comment on posts.
          </p>
        )}

        <div className="comm-post-actions">
          <button
            type="button"
            className={`comm-action-btn ${post.liked_by_me ? "comm-vote-active" : ""}`}
            onClick={() => void toggleLike()}
            disabled={!canInteract || busy === "like"}
            title={canInteract ? undefined : `Join ${communityName} to like posts`}
          >
            <FiHeart size={16} /> {post.like_count}
          </button>
          {/* Comments hidden for now
          <span className="comm-action-btn">{post.comment_count} comments</span>
          */}
          <button
            type="button"
            className="comm-action-btn"
            onClick={() => void onShare()}
            disabled={!canInteract || busy === "share"}
            title={canInteract ? undefined : `Join ${communityName} to share posts`}
          >
            <FiShare2 size={16} /> Share
          </button>
          {canModerate && (
            <button
              type="button"
              className={`comm-action-btn ${pinned ? "comm-vote-active" : ""}`}
              onClick={() => void onPin()}
              disabled={busy === "pin"}
            >
              <FiBookmark size={16} /> {pinned ? "Unpin" : "Pin"}
            </button>
          )}
        </div>
      </article>

      {/* Comments section hidden for now
      <CommentThread
        slug={slug}
        postId={post.id}
        initialComments={initialComments}
        canInteract={canInteract}
      />
      */}
    </div>
  );
}
