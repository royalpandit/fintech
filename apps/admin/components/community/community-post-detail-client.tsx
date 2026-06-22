"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiHeart, FiShare2, FiArrowLeft } from "react-icons/fi";
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
}: {
  slug: string;
  communityName: string;
  post: SocialPost;
  comments: CommunityComment[];
  canInteract: boolean;
  canModerate: boolean;
  linkUrl?: string | null;
}) {
  const router = useRouter();
  const [post, setPost] = useState(initialPost);

  async function toggleLike() {
    const data = await likeCommunityPost(slug, post.id);
    setPost((p) => ({ ...p, liked_by_me: data.liked, like_count: data.like_count }));
  }

  async function onShare() {
    const data = await shareCommunityPost(slug, post.id);
    setPost((p) => ({ ...p, share_count: data.share_count }));
    if (navigator.share) {
      await navigator.share({
        title: post.title ?? "Community post",
        url: window.location.href,
      }).catch(() => {});
    }
  }

  async function onPin() {
    await pinCommunityPost(slug, post.id);
    router.refresh();
  }

  return (
    <div className="comm-post-detail">
      <Link href={`/user/community/${slug}`} className="comm-back-link">
        <FiArrowLeft size={14} /> r/{communityName}
      </Link>

      <article className="comm-post-full">
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

        <div className="comm-post-actions">
          <button
            type="button"
            className={`comm-action-btn ${post.liked_by_me ? "comm-vote-active" : ""}`}
            onClick={() => void toggleLike()}
            disabled={!canInteract}
          >
            <FiHeart size={16} /> {post.like_count}
          </button>
          {/* Comments hidden for now
          <span className="comm-action-btn">{post.comment_count} comments</span>
          */}
          <button type="button" className="comm-action-btn" onClick={() => void onShare()} disabled={!canInteract}>
            <FiShare2 size={16} /> Share
          </button>
          {canModerate && (
            <button type="button" className="comm-action-btn" onClick={() => void onPin()}>
              Pin
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
