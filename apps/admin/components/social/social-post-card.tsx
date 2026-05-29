"use client";

import { useEffect, useRef, useState } from "react";
import {
  FiHeart,
  FiMessageSquare,
  FiShare2,
  FiBookmark,
  FiMoreHorizontal,
  FiFlag,
  FiTrash2,
  FiEdit2,
  FiTrendingDown,
  FiTrendingUp,
  FiMinus,
} from "react-icons/fi";
import { formatRelativeTime } from "@/lib/format-date";
import AttachedSymbolCard from "./attached-symbol-card";
import { PostImageGallery, PostMediaImage } from "./post-image-gallery";
import { formatPostText } from "./format-post-text";
import type { SocialPost } from "@/lib/social-feed-types";
import type { SocialComment } from "@/lib/social-feed-client";

const SENTIMENT: Record<
  string,
  { bg: string; color: string; border: string; label: string; Icon: typeof FiTrendingUp }
> = {
  bullish: {
    bg: "#ecfdf5",
    color: "#059669",
    border: "#a7f3d0",
    label: "Bullish",
    Icon: FiTrendingUp,
  },
  bearish: {
    bg: "#fef2f2",
    color: "#dc2626",
    border: "#fecaca",
    label: "Bearish",
    Icon: FiTrendingDown,
  },
  neutral: {
    bg: "#f8fafc",
    color: "#64748b",
    border: "#e2e8f0",
    label: "Neutral",
    Icon: FiMinus,
  },
};

function getInitials(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "??";
  return (p[0][0] + (p[p.length - 1]?.[0] ?? "")).toUpperCase();
}

export default function SocialPostCard({
  post,
  isAuthed,
  onLike,
  onSave,
  onDelete,
  onReport,
  onEdit,
  comments,
  commentsOpen,
  onToggleComments,
  commentInput,
  onCommentInput,
  onSubmitComment,
  commentsLoading,
}: {
  post: SocialPost;
  isAuthed: boolean;
  onLike: () => void;
  onSave: () => void;
  onDelete: () => void;
  onReport: () => void;
  onEdit: () => void;
  comments: SocialComment[];
  commentsOpen: boolean;
  onToggleComments: () => void;
  commentInput: string;
  onCommentInput: (v: string) => void;
  onSubmitComment: () => void;
  commentsLoading: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const sent = post.sentiment ? SENTIMENT[post.sentiment] : null;

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const share = async () => {
    const url = `${window.location.origin}/user/feed?post=${post.uuid}`;
    if (navigator.share) {
      await navigator.share({ title: post.title ?? "Market idea", url });
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  const bodyText =
    post.post_type === "article" ? post.article_body ?? post.content : post.content;

  const showMenu = post.is_own || (isAuthed && !post.is_own);

  return (
    <article className="sf-post-card">
      <header className="sf-post-head">
        <div className="sf-post-head-left">
          <div className="sf-avatar sf-avatar-feed">{getInitials(post.user.fullName)}</div>
          <div className="sf-post-meta">
            <span className="sf-post-author">{post.user.fullName}</span>
            <span className="sf-post-time">{formatRelativeTime(post.created_at)}</span>
          </div>
        </div>

        <div className="sf-post-head-right">
          {sent && (
            <span
              className="sf-sentiment-badge"
              style={{
                background: sent.bg,
                color: sent.color,
                borderColor: sent.border,
              }}
            >
              <sent.Icon size={11} strokeWidth={2.5} />
              {sent.label}
            </span>
          )}

          {showMenu && (
            <div className="sf-post-menu-wrap" ref={menuRef}>
              <button
                type="button"
                className={`sf-post-menu-btn${menuOpen ? " open" : ""}`}
                onClick={() => setMenuOpen(v => !v)}
                aria-expanded={menuOpen}
                aria-label="Post options"
              >
                <FiMoreHorizontal size={18} />
              </button>

              {menuOpen && (
                <div className="sf-post-menu" role="menu">
                  {post.is_own && (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          onEdit();
                        }}
                      >
                        <FiEdit2 size={14} />
                        Edit post
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="danger"
                        onClick={() => {
                          setMenuOpen(false);
                          onDelete();
                        }}
                      >
                        <FiTrash2 size={14} />
                        Delete post
                      </button>
                    </>
                  )}
                  {isAuthed && !post.is_own && (
                    <button
                      type="button"
                      role="menuitem"
                      className="danger"
                      onClick={() => {
                        setMenuOpen(false);
                        onReport();
                      }}
                    >
                      <FiFlag size={14} />
                      Report post
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {post.post_type === "article" && post.title && (
        <h3 className="sf-post-article-title">{post.title}</h3>
      )}

      {bodyText && (
        <div className="sf-post-text">{formatPostText(bodyText)}</div>
      )}

      {post.symbols.length > 0 && (
        <div className="sf-post-symbols">
          {post.symbols.map(s => (
            <AttachedSymbolCard key={s.id} item={s} variant="feed" />
          ))}
        </div>
      )}

      {(post.target_price != null || post.stop_loss_price != null) && (
        <div className="sf-post-levels">
          {post.target_price != null && (
            <div className="sf-level-chip target">
              <span className="sf-level-label">Target</span>
              <span className="sf-level-value">
                ₹{post.target_price.toLocaleString("en-IN")}
              </span>
            </div>
          )}
          {post.stop_loss_price != null && (
            <div className="sf-level-chip sl">
              <span className="sf-level-label">Stop loss</span>
              <span className="sf-level-value">
                ₹{post.stop_loss_price.toLocaleString("en-IN")}
              </span>
            </div>
          )}
        </div>
      )}

      {post.thumbnail_url && <PostMediaImage url={post.thumbnail_url} />}

      {post.images.length > 0 && <PostImageGallery images={post.images} />}

      {post.videos.length > 0 && (
        <div className="sf-post-video">
          <video src={post.videos[0].url} controls />
        </div>
      )}

      <footer className="sf-post-actions">
        <button
          type="button"
          className={`sf-action-btn${post.liked_by_me ? " liked" : ""}`}
          onClick={onLike}
          disabled={!isAuthed}
        >
          <FiHeart size={17} />
          <span>{post.like_count || "Like"}</span>
        </button>
        <button
          type="button"
          className={`sf-action-btn${commentsOpen ? " active" : ""}`}
          onClick={onToggleComments}
        >
          <FiMessageSquare size={17} />
          <span>{post.comment_count || "Comment"}</span>
        </button>
        <button type="button" className="sf-action-btn" onClick={share}>
          <FiShare2 size={17} />
          <span>Share</span>
        </button>
        <button
          type="button"
          className={`sf-action-btn sf-action-save${post.saved_by_me ? " saved" : ""}`}
          onClick={onSave}
          disabled={!isAuthed}
          title="Bookmark"
        >
          <FiBookmark size={17} />
        </button>
      </footer>

      {commentsOpen && (
        <div className="sf-comments">
          {commentsLoading && <p className="sf-comments-loading">Loading comments…</p>}
          {!commentsLoading && comments.length === 0 && (
            <p className="sf-comments-empty">No comments yet — start the discussion.</p>
          )}
          {comments.map(c => (
            <div key={c.id} className="sf-comment">
              <div className="sf-comment-avatar">{getInitials(c.user.fullName)}</div>
              <div className="sf-comment-body">
                <strong>{c.user.fullName}</strong>
                <p>{c.content}</p>
                {c.replies.map(r => (
                  <div key={r.id} className="sf-comment reply">
                    <strong>{r.user.fullName}</strong>
                    <p>{r.content}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {isAuthed && (
            <div className="sf-comment-form">
              <input
                type="text"
                placeholder="Write a comment…"
                value={commentInput}
                onChange={e => onCommentInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && onSubmitComment()}
              />
              <button type="button" onClick={onSubmitComment}>
                Post
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
