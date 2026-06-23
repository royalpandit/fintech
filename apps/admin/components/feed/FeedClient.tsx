"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/format-date";
import {
  FiHeart,
  FiMessageSquare,
  FiUserPlus,
  FiUserCheck,
  FiMoreHorizontal,
  FiFlag,
  FiSlash,
  FiSend,
  FiX,
  FiTrendingUp,
  FiChevronDown,
} from "react-icons/fi";
import { CheckCircle } from "@/components/advisor-ui/icons";
import SocialFeedSection from "@/components/social/social-feed-section";
import PremiumPostOverlay from "@/components/posts/premium-post-overlay";
import PremiumUnlockModal from "@/components/posts/premium-unlock-modal";
import { usePremiumPostUnlock } from "@/components/posts/use-premium-post-unlock";
import FeedFilter, { DEFAULT_FEED_FILTERS, type FeedFilters } from "@/components/feed/feed-filter";

// ─── Types ────────────────────────────────────────────────

type Reply = {
  id: number;
  content: string;
  createdAt: string;
  deletedAt: string | null;
  user: { fullName: string };
};

type Comment = {
  id: number;
  content: string;
  createdAt: string;
  deletedAt: string | null;
  user: { fullName: string };
  replies: Reply[];
  _count: { replies: number };
};

type FeedPost = {
  id: number;
  title: string;
  content: string;
  marketSymbol: string | null;
  assetType: string;
  riskLevel: string;
  sentiment: string;
  publishedAt: string | null;
  createdAt: string;
  post_access_type?: "free" | "paid";
  unlock_price?: number | null;
  is_unlocked?: boolean;
  is_locked?: boolean;
  advisor: {
    id: number;
    fullName: string;
    advisorProfile: { sebiRegistrationNo: string | null } | null;
  } | null;
  _count: { reactions: number; comments: number };
};

export type FeedClientProps = {
  initialFollowedPosts: FeedPost[];
  initialDiscoverPosts: FeedPost[];
  initialNextCursor: number | null;
  isAuthed: boolean;
  userId: number | null;
  initialFollowedIds: number[];
  initialLikedPostIds: number[];
  currentUserName?: string | null;
  suggestedAdvisors: {
    userId: number;
    user: { id: number; fullName: string; _count: { followers: number } } | null;
  }[];
  trendingSymbols: { marketSymbol: string | null; _count: { _all: number } }[];
};

// ─── Constants ────────────────────────────────────────────

const SENTIMENT_COLORS: Record<string, string> = {
  bullish: "#16a34a",
  bearish: "#dc2626",
  neutral: "#64748b",
};

const REPORT_REASONS = [
  "Spam",
  "Misinformation / False claims",
  "Harassment",
  "Inappropriate content",
  "Other",
];

// ─── Helpers ──────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─── Sub-components ───────────────────────────────────────

function CommentBubble({
  comment,
  postId,
  onReply,
}: {
  comment: Comment | Reply;
  postId: number;
  onReply: (commentId: number) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 6,
          background: "linear-gradient(135deg, rgba(14,165,233,0.13), rgba(16,185,129,0.13))",
          color: "#0ea5e9",
          display: "grid",
          placeItems: "center",
          fontSize: 9,
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {getInitials(comment.user.fullName)}
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            background: "var(--surface-2)",
            borderRadius: "0 10px 10px 10px",
            padding: "8px 12px",
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)" }}>
            {comment.user.fullName}
          </span>
          <p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--text)", lineHeight: 1.45 }}>
            {comment.deletedAt ? (
              <em style={{ color: "var(--text-muted)" }}>Comment removed</em>
            ) : (
              comment.content
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 4, paddingLeft: 4 }}>
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
            {formatRelativeTime(comment.createdAt)}
          </span>
          {"_count" in comment === false && (
            <button
              type="button"
              onClick={() => onReply(comment.id)}
              style={{
                background: "none",
                border: "none",
                fontSize: 10,
                fontWeight: 600,
                color: "#0ea5e9",
                cursor: "pointer",
                padding: 0,
              }}
            >
              Reply
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Post Card ────────────────────────────────────────────

function PostCard({
  post,
  isAuthed,
  liked,
  likeCount,
  commentCount,
  following,
  followLoading,
  onLike,
  onFollow,
  expanded,
  onToggleComments,
  comments,
  commentsLoading,
  commentInput,
  onCommentInput,
  replyToId,
  onSetReply,
  submitting,
  onSubmitComment,
  reported,
  onReport,
  blocked,
  onBlock,
}: {
  post: FeedPost;
  isAuthed: boolean;
  liked: boolean;
  likeCount: number;
  commentCount: number;
  following: boolean;
  followLoading: boolean;
  onLike: () => void;
  onFollow: () => void;
  expanded: boolean;
  onToggleComments: () => void;
  comments: Comment[];
  commentsLoading: boolean;
  commentInput: string;
  onCommentInput: (v: string) => void;
  replyToId: number | null;
  onSetReply: (id: number | null) => void;
  submitting: boolean;
  onSubmitComment: (parentId?: number) => void;
  reported: boolean;
  onReport: () => void;
  blocked: boolean;
  onBlock: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [postState, setPostState] = useState(post);
  const menuRef = useRef<HTMLDivElement>(null);
  const sColor = SENTIMENT_COLORS[postState.sentiment] ?? "#64748b";
  const initials = getInitials(postState.advisor?.fullName ?? "??");
  const when = postState.publishedAt ?? postState.createdAt;

  const premium = usePremiumPostUnlock({
    postId: postState.id,
    kind: "market",
    initialLocked: Boolean(postState.is_locked),
    initialUnlocked: Boolean(postState.is_unlocked),
    isAuthed,
    onUnlocked: (full) => {
      const f = full as FeedPost;
      setPostState((prev) => ({
        ...prev,
        ...f,
        is_locked: false,
        is_unlocked: true,
        content: String(f.content ?? prev.content),
      }));
    },
  });
  const locked = premium.locked;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (blocked) return null;

  return (
    <article
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: 18,
        position: "relative",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center" }}>
        <Link
          href={`/user/advisors/${post.advisor?.id}`}
          style={{
            width: 38,
            height: 38,
            borderRadius: 9,
            background: "linear-gradient(135deg, rgba(14,165,233,0.13), rgba(16,185,129,0.13))",
            color: "#0ea5e9",
            display: "grid",
            placeItems: "center",
            fontSize: 12,
            fontWeight: 600,
            flexShrink: 0,
            textDecoration: "none",
          }}
        >
          {initials}
        </Link>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <Link
              href={`/user/advisors/${post.advisor?.id}`}
              style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", textDecoration: "none" }}
            >
              {post.advisor?.fullName}
            </Link>
            <CheckCircle size={12} style={{ color: "#10b981" }} />
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {post.advisor?.advisorProfile?.sebiRegistrationNo} · {formatRelativeTime(when)}
          </div>
        </div>

        {/* Follow toggle */}
        {isAuthed && post.advisor && (
          <button
            type="button"
            onClick={onFollow}
            disabled={followLoading}
            title={following ? "Unfollow" : "Follow"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "5px 12px",
              borderRadius: 8,
              border: following ? "1px solid var(--border)" : "1px solid #0ea5e9",
              background: following ? "var(--surface-2)" : "rgba(14,165,233,0.08)",
              color: following ? "var(--text-muted)" : "#0ea5e9",
              fontSize: 11,
              fontWeight: 700,
              cursor: followLoading ? "wait" : "pointer",
            }}
          >
            {following ? <FiUserCheck size={12} /> : <FiUserPlus size={12} />}
            {following ? "Following" : "Follow"}
          </button>
        )}

        {/* Sentiment pill */}
        <span
          style={{
            padding: "3px 10px",
            borderRadius: 999,
            background: `${sColor}1a`,
            color: sColor,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: 0.5,
            textTransform: "uppercase",
            flexShrink: 0,
          }}
        >
          {postState.sentiment}
        </span>

        {/* Three-dot menu */}
        <div ref={menuRef} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              padding: 4,
              borderRadius: 6,
            }}
          >
            <FiMoreHorizontal size={16} />
          </button>

          {menuOpen && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 4px)",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                boxShadow: "0 8px 32px rgba(15,23,42,0.12)",
                zIndex: 20,
                minWidth: 160,
                overflow: "hidden",
              }}
            >
              {isAuthed && !reported && (
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onReport(); }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 14px",
                    background: "none",
                    border: "none",
                    fontSize: 13,
                    color: "#dc2626",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <FiFlag size={13} /> Report post
                </button>
              )}
              {reported && (
                <div style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-muted)" }}>
                  Reported — thanks
                </div>
              )}
              {isAuthed && post.advisor && (
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onBlock(); }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 14px",
                    background: "none",
                    border: "none",
                    fontSize: 13,
                    color: "var(--text)",
                    cursor: "pointer",
                    textAlign: "left",
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <FiSlash size={13} /> Block advisor
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={`premium-post-body${locked ? " is-locked" : ""}`}>
        {locked ? (
          <div style={{ textDecoration: "none", color: "inherit" }}>
            <h3
              style={{
                margin: "0 0 8px",
                fontSize: 17,
                fontWeight: 700,
                color: "var(--text)",
                letterSpacing: -0.2,
              }}
            >
              {postState.title}
            </h3>
            <p
              className="premium-text-blur"
              style={{
                margin: 0,
                fontSize: 14,
                color: "var(--text)",
                lineHeight: 1.55,
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {postState.content}
            </p>
          </div>
        ) : (
          <Link
            href={`/user/markets/${postState.id}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <h3
              style={{
                margin: "0 0 8px",
                fontSize: 17,
                fontWeight: 700,
                color: "var(--text)",
                letterSpacing: -0.2,
              }}
            >
              {postState.title}
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                color: "var(--text)",
                lineHeight: 1.55,
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {postState.content}
            </p>
          </Link>
        )}
        {locked && <PremiumPostOverlay onUnlock={premium.openUnlock} />}
      </div>

      {/* Tags */}
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        {postState.marketSymbol && (
          <span
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              background: "var(--surface-2)",
              color: "var(--text)",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {postState.marketSymbol}
          </span>
        )}
        <span
          style={{
            padding: "4px 10px",
            borderRadius: 999,
            background: "var(--surface-2)",
            color: "var(--text)",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {postState.assetType.toUpperCase()}
        </span>
        <span
          style={{
            padding: "4px 10px",
            borderRadius: 999,
            background:
              postState.riskLevel === "high"
                ? "#fee2e2"
                : postState.riskLevel === "medium"
                  ? "#fef3c7"
                  : "#d1fae5",
            color:
              postState.riskLevel === "high"
                ? "#991b1b"
                : postState.riskLevel === "medium"
                  ? "#92400e"
                  : "#047857",
            fontSize: 11,
            fontWeight: 700,
            textTransform: "capitalize",
          }}
        >
          {postState.riskLevel} risk
        </span>
      </div>

      <PremiumUnlockModal
        open={premium.modalOpen}
        onClose={() => premium.setModalOpen(false)}
        onUnlock={premium.confirmUnlock}
        loading={premium.loading}
      />

      {/* Action bar */}
      <div
        style={{
          marginTop: 14,
          paddingTop: 14,
          borderTop: "1px solid var(--border)",
          display: "flex",
          gap: 16,
          alignItems: "center",
        }}
      >
        {/* Like */}
        <button
          type="button"
          onClick={isAuthed ? onLike : undefined}
          title={isAuthed ? (liked ? "Unlike" : "Like") : "Sign in to like"}
          style={{
            border: "none",
            background: "transparent",
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: liked ? "#e11d48" : "var(--text-muted)",
            fontSize: 12,
            fontWeight: 600,
            cursor: isAuthed ? "pointer" : "default",
            transition: "color 0.15s",
          }}
        >
          <FiHeart
            size={13}
            style={{ fill: liked ? "#e11d48" : "none", color: liked ? "#e11d48" : "var(--text-muted)" }}
          />
          {likeCount}
        </button>

        {/* Comments toggle */}
        <button
          type="button"
          onClick={onToggleComments}
          style={{
            border: "none",
            background: "transparent",
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: expanded ? "#0ea5e9" : "var(--text-muted)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <FiMessageSquare size={13} />
          {commentCount} {commentCount === 1 ? "comment" : "comments"}
          <FiChevronDown
            size={11}
            style={{
              transition: "transform 0.2s",
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        </button>
      </div>

      {/* Comment section */}
      {expanded && (
        <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
          {commentsLoading ? (
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Loading comments…</p>
          ) : comments.length === 0 ? (
            <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--text-muted)" }}>
              No comments yet — be the first.
            </p>
          ) : (
            <div style={{ marginBottom: 12 }}>
              {comments.map((c) => (
                <div key={c.id}>
                  <CommentBubble
                    comment={c}
                    postId={post.id}
                    onReply={(id) => onSetReply(replyToId === id ? null : id)}
                  />
                  {/* Replies */}
                  {c.replies.length > 0 && (
                    <div style={{ marginLeft: 34, marginBottom: 8 }}>
                      {c.replies.map((r) => (
                        <CommentBubble
                          key={r.id}
                          comment={r as Comment}
                          postId={post.id}
                          onReply={() => onSetReply(c.id)}
                        />
                      ))}
                    </div>
                  )}
                  {/* Reply form */}
                  {replyToId === c.id && isAuthed && (
                    <div
                      style={{
                        marginLeft: 34,
                        marginBottom: 8,
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <input
                        autoFocus
                        value={commentInput}
                        onChange={(e) => onCommentInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            onSubmitComment(c.id);
                          }
                        }}
                        placeholder={`Reply to ${c.user.fullName}…`}
                        style={{
                          flex: 1,
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          padding: "7px 11px",
                          fontSize: 12,
                          outline: "none",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => onSubmitComment(c.id)}
                        disabled={submitting || !commentInput.trim()}
                        style={{
                          background: "#0ea5e9",
                          border: "none",
                          borderRadius: 8,
                          color: "#fff",
                          padding: "7px 10px",
                          cursor: submitting ? "wait" : "pointer",
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        <FiSend size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onSetReply(null)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--text-muted)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        <FiX size={12} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* New comment input */}
          {isAuthed ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                value={replyToId ? "" : commentInput}
                onChange={(e) => { if (!replyToId) onCommentInput(e.target.value); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !replyToId) {
                    e.preventDefault();
                    onSubmitComment();
                  }
                }}
                placeholder="Write a comment…"
                style={{
                  flex: 1,
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 13,
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={() => onSubmitComment()}
                disabled={submitting || !commentInput.trim() || !!replyToId}
                style={{
                  background: "#0ea5e9",
                  border: "none",
                  borderRadius: 8,
                  color: "#fff",
                  padding: "8px 12px",
                  cursor: submitting ? "wait" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <FiSend size={12} /> Post
              </button>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
              <Link href="/login" style={{ color: "#0ea5e9", fontWeight: 600 }}>
                Sign in
              </Link>{" "}
              to join the conversation.
            </p>
          )}
        </div>
      )}
    </article>
  );
}

// ─── Report Modal ─────────────────────────────────────────

function ReportModal({
  postId,
  onClose,
}: {
  postId: number;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (!reason || loading) return;
    setLoading(true);
    try {
      await fetch(`/api/v1/market/posts/${postId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      setDone(true);
      setTimeout(onClose, 1500);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.55)",
        backdropFilter: "blur(4px)",
        zIndex: 100,
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 420,
          background: "var(--surface)",
          borderRadius: 18,
          padding: 28,
          boxShadow: "0 24px 80px rgba(15,23,42,0.18)",
        }}
      >
        {done ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>✓</div>
            <p style={{ margin: 0, fontWeight: 700, color: "var(--text)" }}>Report submitted</p>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
              Our team will review it shortly.
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: "var(--text)" }}>
                Report this post
              </h3>
              <button
                type="button"
                onClick={onClose}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
              >
                <FiX size={18} />
              </button>
            </div>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--text-muted)" }}>
              Why are you reporting this post?
            </p>
            <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
              {REPORT_REASONS.map((r) => (
                <label
                  key={r}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: `1px solid ${reason === r ? "#0ea5e9" : "var(--border)"}`,
                    background: reason === r ? "rgba(14,165,233,0.06)" : "var(--surface)",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--text)",
                  }}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    style={{ accentColor: "#0ea5e9" }}
                  />
                  {r}
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={!reason || loading}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 10,
                border: "none",
                background: reason ? "#dc2626" : "var(--border)",
                color: reason ? "#fff" : "var(--text-muted)",
                fontWeight: 700,
                fontSize: 14,
                cursor: reason ? "pointer" : "default",
              }}
            >
              {loading ? "Submitting…" : "Submit report"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        margin: "0 0 10px",
        fontSize: 11,
        fontWeight: 700,
        color: "var(--text-muted)",
        textTransform: "uppercase",
        letterSpacing: 1,
      }}
    >
      {children}
    </h2>
  );
}

// ─── Main FeedClient ──────────────────────────────────────

export default function FeedClient({
  initialFollowedPosts,
  initialDiscoverPosts,
  initialNextCursor,
  isAuthed,
  userId,
  initialFollowedIds,
  initialLikedPostIds,
  currentUserName,
  suggestedAdvisors,
  trendingSymbols,
}: FeedClientProps) {
  // Feed state
  const [discoverPosts, setDiscoverPosts] = useState<FeedPost[]>(initialDiscoverPosts);
  const [nextCursor, setNextCursor] = useState<number | null>(initialNextCursor);
  const [loadingMore, setLoadingMore] = useState(false);

  // Per-post interaction state
  const [likedPosts, setLikedPosts] = useState<Set<number>>(new Set(initialLikedPostIds));
  const [likeCounts, setLikeCounts] = useState<Map<number, number>>(
    new Map(
      [...initialFollowedPosts, ...initialDiscoverPosts].map((p) => [p.id, p._count.reactions]),
    ),
  );
  const [commentCounts, setCommentCounts] = useState<Map<number, number>>(
    new Map(
      [...initialFollowedPosts, ...initialDiscoverPosts].map((p) => [p.id, p._count.comments]),
    ),
  );

  // Follow state
  const [followedAdvisors, setFollowedAdvisors] = useState<Set<number>>(
    new Set(initialFollowedIds),
  );
  const [followLoading, setFollowLoading] = useState<Set<number>>(new Set());

  // Comment state
  const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set());
  const [commentsData, setCommentsData] = useState<Map<number, Comment[]>>(new Map());
  const [commentsLoading, setCommentsLoading] = useState<Set<number>>(new Set());
  const [commentInput, setCommentInput] = useState<Map<number, string>>(new Map());
  const [replyTo, setReplyTo] = useState<Map<number, number | null>>(new Map());
  const [submittingComment, setSubmittingComment] = useState<Set<number>>(new Set());

  // Report & block state
  const [reportingPost, setReportingPost] = useState<number | null>(null);
  const [reportedPosts, setReportedPosts] = useState<Set<number>>(new Set());
  const [blockedAdvisors, setBlockedAdvisors] = useState<Set<number>>(new Set());

  // Feed filters (client-side: sort + direction/asset/risk/access).
  const [filters, setFilters] = useState<FeedFilters>(DEFAULT_FEED_FILTERS);

  function applyFilters(posts: FeedPost[]): FeedPost[] {
    const out = posts.filter((p) => {
      if (filters.sentiment !== "all" && p.sentiment !== filters.sentiment) return false;
      if (filters.asset !== "all" && p.assetType !== filters.asset) return false;
      if (filters.risk !== "all" && p.riskLevel !== filters.risk) return false;
      if (filters.access !== "all" && (p.post_access_type ?? "free") !== filters.access) return false;
      return true;
    });
    return out.sort((a, b) => {
      const ta = new Date(a.publishedAt ?? a.createdAt).getTime();
      const tb = new Date(b.publishedAt ?? b.createdAt).getTime();
      return filters.sort === "latest" ? tb - ta : ta - tb;
    });
  }

  const sentinelRef = useRef<HTMLDivElement>(null);

  // ── Infinite scroll ──────────────────────────────────────
  const fetchMore = useCallback(async () => {
    if (loadingMore || !nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/v1/user/feed?cursor=${nextCursor}&limit=10`);
      if (!res.ok) return;
      const json = await res.json();
      const newPosts: FeedPost[] = json.data ?? [];
      const newLiked: number[] = json.likedPostIds ?? [];

      setDiscoverPosts((prev) => [...prev, ...newPosts]);
      setNextCursor(json.nextCursor ?? null);
      setLikedPosts((prev) => {
        const next = new Set(prev);
        newLiked.forEach((id) => next.add(id));
        return next;
      });
      setLikeCounts((prev) => {
        const next = new Map(prev);
        newPosts.forEach((p) => next.set(p.id, p._count.reactions));
        return next;
      });
      setCommentCounts((prev) => {
        const next = new Map(prev);
        newPosts.forEach((p) => next.set(p.id, p._count.comments));
        return next;
      });
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, nextCursor]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && nextCursor) fetchMore(); },
      { rootMargin: "300px" },
    );
    const sentinel = sentinelRef.current;
    if (sentinel) observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchMore, nextCursor]);

  // ── Like ─────────────────────────────────────────────────
  async function toggleLike(postId: number) {
    if (!isAuthed) return;
    const wasLiked = likedPosts.has(postId);
    setLikedPosts((prev) => {
      const next = new Set(prev);
      wasLiked ? next.delete(postId) : next.add(postId);
      return next;
    });
    setLikeCounts((prev) => {
      const next = new Map(prev);
      next.set(postId, Math.max(0, (prev.get(postId) ?? 0) + (wasLiked ? -1 : 1)));
      return next;
    });
    try {
      await fetch(`/api/v1/market/posts/${postId}/like`, { method: "POST" });
    } catch {
      // Revert optimistic update
      setLikedPosts((prev) => {
        const next = new Set(prev);
        wasLiked ? next.add(postId) : next.delete(postId);
        return next;
      });
      setLikeCounts((prev) => {
        const next = new Map(prev);
        next.set(postId, Math.max(0, (prev.get(postId) ?? 0) + (wasLiked ? 1 : -1)));
        return next;
      });
    }
  }

  // ── Follow ───────────────────────────────────────────────
  async function toggleFollow(advisorId: number) {
    if (!isAuthed || followLoading.has(advisorId)) return;
    const wasFollowing = followedAdvisors.has(advisorId);
    setFollowLoading((prev) => new Set([...prev, advisorId]));
    setFollowedAdvisors((prev) => {
      const next = new Set(prev);
      wasFollowing ? next.delete(advisorId) : next.add(advisorId);
      return next;
    });
    try {
      const url = wasFollowing
        ? `/api/v1/community/unfollow/${advisorId}`
        : `/api/v1/community/follow/${advisorId}`;
      await fetch(url, { method: "POST" });
    } catch {
      setFollowedAdvisors((prev) => {
        const next = new Set(prev);
        wasFollowing ? next.add(advisorId) : next.delete(advisorId);
        return next;
      });
    } finally {
      setFollowLoading((prev) => {
        const next = new Set(prev);
        next.delete(advisorId);
        return next;
      });
    }
  }

  // ── Comments ─────────────────────────────────────────────
  async function loadComments(postId: number) {
    if (commentsLoading.has(postId) || commentsData.has(postId)) return;
    setCommentsLoading((prev) => new Set([...prev, postId]));
    try {
      const res = await fetch(`/api/v1/market/posts/${postId}/comments`);
      if (res.ok) {
        const json = await res.json();
        setCommentsData((prev) => new Map([...prev, [postId, json.data ?? []]]));
      }
    } finally {
      setCommentsLoading((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }
  }

  function toggleComments(postId: number) {
    setExpandedComments((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
        loadComments(postId);
      }
      return next;
    });
  }

  async function submitComment(postId: number, parentId?: number) {
    const text = commentInput.get(postId)?.trim() ?? "";
    if (!text || !isAuthed || submittingComment.has(postId)) return;
    setSubmittingComment((prev) => new Set([...prev, postId]));
    try {
      const res = await fetch(`/api/v1/market/posts/${postId}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, parentId }),
      });
      if (!res.ok) return;
      const json = await res.json();
      const newComment = json.data?.comment ?? json.comment;

      const ghost = {
        ...newComment,
        user: { fullName: "You" },
        replies: [],
        _count: { replies: 0 },
      };

      setCommentsData((prev) => {
        const existing = prev.get(postId) ?? [];
        if (parentId) {
          return new Map([
            ...prev,
            [
              postId,
              existing.map((c) =>
                c.id === parentId ? { ...c, replies: [...c.replies, ghost] } : c,
              ),
            ],
          ]);
        }
        return new Map([...prev, [postId, [...existing, ghost]]]);
      });

      setCommentInput((prev) => new Map([...prev, [postId, ""]]));
      setReplyTo((prev) => new Map([...prev, [postId, null]]));
      setCommentCounts((prev) => new Map([...prev, [postId, (prev.get(postId) ?? 0) + 1]]));
    } finally {
      setSubmittingComment((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }
  }

  // ── Block ────────────────────────────────────────────────
  async function blockAdvisor(advisorId: number) {
    if (!isAuthed) return;
    setBlockedAdvisors((prev) => new Set([...prev, advisorId]));
    await fetch(`/api/v1/users/${advisorId}/block`, { method: "POST" });
  }

  // ── Render helpers ────────────────────────────────────────
  function renderPost(post: FeedPost) {
    const advisorId = post.advisor?.id;
    return (
      <PostCard
        key={post.id}
        post={post}
        isAuthed={isAuthed}
        liked={likedPosts.has(post.id)}
        likeCount={likeCounts.get(post.id) ?? post._count.reactions}
        commentCount={commentCounts.get(post.id) ?? post._count.comments}
        following={advisorId ? followedAdvisors.has(advisorId) : false}
        followLoading={advisorId ? followLoading.has(advisorId) : false}
        onLike={() => toggleLike(post.id)}
        onFollow={() => advisorId && toggleFollow(advisorId)}
        expanded={expandedComments.has(post.id)}
        onToggleComments={() => toggleComments(post.id)}
        comments={commentsData.get(post.id) ?? []}
        commentsLoading={commentsLoading.has(post.id)}
        commentInput={commentInput.get(post.id) ?? ""}
        onCommentInput={(v) => setCommentInput((prev) => new Map([...prev, [post.id, v]]))}
        replyToId={replyTo.get(post.id) ?? null}
        onSetReply={(id) => setReplyTo((prev) => new Map([...prev, [post.id, id]]))}
        submitting={submittingComment.has(post.id)}
        onSubmitComment={(parentId) => submitComment(post.id, parentId)}
        reported={reportedPosts.has(post.id)}
        onReport={() => setReportingPost(post.id)}
        blocked={advisorId ? blockedAdvisors.has(advisorId) : false}
        onBlock={() => advisorId && blockAdvisor(advisorId)}
      />
    );
  }

  const filteredFollowed = applyFilters(initialFollowedPosts);
  const filteredDiscover = applyFilters(discoverPosts);
  const hasFollowed = filteredFollowed.length > 0;

  return (
    <>
      <div className="user-layout-rail">
        {/* Feed column */}
        <div>
          <SocialFeedSection
            isAuthed={isAuthed}
            userName={currentUserName ?? "You"}
          />

          {/* Feed header: section label + filter on the same row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 11,
                fontWeight: 700,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              {hasFollowed ? "Following" : "Latest posts"}
            </h2>
            <FeedFilter value={filters} onChange={setFilters} />
          </div>

          {/* Following section */}
          {hasFollowed && (
            <>
              <div style={{ display: "grid", gap: 12, marginBottom: 20 }}>
                {filteredFollowed.map(renderPost)}
              </div>
              <SectionLabel>Discover</SectionLabel>
            </>
          )}

          {/* Discover / global */}
          <div style={{ display: "grid", gap: 12 }}>
            {filteredDiscover.length === 0 && !loadingMore ? (
              <article
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  padding: 32,
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: 13,
                }}
              >
                {discoverPosts.length === 0
                  ? "No posts yet — check back soon."
                  : "No posts match your filters."}
              </article>
            ) : (
              filteredDiscover.map(renderPost)
            )}
          </div>

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} style={{ height: 1 }} />

          {loadingMore && (
            <div
              style={{
                textAlign: "center",
                padding: "20px 0",
                color: "var(--text-muted)",
                fontSize: 13,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  border: "2px solid var(--border)",
                  borderTopColor: "#0ea5e9",
                  animation: "spin 0.7s linear infinite",
                  display: "inline-block",
                }}
              />
              Loading more…
            </div>
          )}

          {!nextCursor && discoverPosts.length > 0 && (
            <p
              style={{
                textAlign: "center",
                padding: "20px 0",
                color: "var(--text-muted)",
                fontSize: 12,
              }}
            >
              You&apos;re all caught up.
            </p>
          )}
        </div>

        {/* Right rail */}
        <aside style={{ display: "grid", gap: 14 }}>
          {/* Suggested advisors */}
          <article
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 16,
            }}
          >
            <h3 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
              Suggested advisors
            </h3>
            {suggestedAdvisors.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>No suggestions right now.</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {suggestedAdvisors.map((sa) => {
                  const advisorId = sa.user?.id;
                  const isFollowing = advisorId ? followedAdvisors.has(advisorId) : false;
                  return (
                    <div
                      key={sa.userId}
                      style={{ display: "flex", alignItems: "center", gap: 10 }}
                    >
                      <Link
                        href={`/user/advisors/${advisorId}`}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          background:
                            "linear-gradient(135deg, rgba(14,165,233,0.13), rgba(16,185,129,0.13))",
                          color: "#0ea5e9",
                          display: "grid",
                          placeItems: "center",
                          fontSize: 11,
                          fontWeight: 600,
                          flexShrink: 0,
                          textDecoration: "none",
                        }}
                      >
                        {getInitials(sa.user?.fullName ?? "??")}
                      </Link>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: "var(--text)" }}
                        >
                          {sa.user?.fullName}
                          <CheckCircle size={11} style={{ color: "#10b981" }} />
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                          {sa.user?._count.followers ?? 0} followers
                        </div>
                      </div>
                      {isAuthed && advisorId && (
                        <button
                          type="button"
                          onClick={() => toggleFollow(advisorId)}
                          disabled={followLoading.has(advisorId)}
                          style={{
                            padding: "4px 10px",
                            borderRadius: 8,
                            border: isFollowing ? "1px solid var(--border)" : "1px solid #0ea5e9",
                            background: isFollowing ? "var(--surface-2)" : "rgba(14,165,233,0.08)",
                            color: isFollowing ? "var(--text-muted)" : "#0ea5e9",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          {isFollowing ? "Following" : "Follow"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <Link
              href="/user/advisors"
              style={{
                display: "block",
                textAlign: "center",
                marginTop: 14,
                padding: "8px 12px",
                borderRadius: 8,
                background: "var(--surface-2)",
                color: "var(--text)",
                fontSize: 12,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Browse all advisors
            </Link>
          </article>

          {/* Trending */}
          <article
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 16,
            }}
          >
            <h3
              style={{
                margin: "0 0 12px",
                fontSize: 13,
                fontWeight: 700,
                color: "var(--text)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <FiTrendingUp size={14} /> Trending this week
            </h3>
            {trendingSymbols.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Nothing trending yet.</p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {trendingSymbols.map((s) => (
                  <Link
                    key={s.marketSymbol ?? "—"}
                    href={`/user/markets?symbol=${encodeURIComponent(s.marketSymbol ?? "")}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 12px",
                      borderRadius: 8,
                      background: "var(--surface-2)",
                      textDecoration: "none",
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                      {s.marketSymbol}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)" }}>
                      {s._count._all} posts
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </article>

          {/* Guest CTA */}
          {!isAuthed && (
            <article
              style={{
                background: "linear-gradient(135deg, #0c4a6e 0%, #0e7490 60%, #047857 100%)",
                color: "#fff",
                borderRadius: 14,
                padding: 18,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  color: "#a7f3d0",
                  marginBottom: 6,
                  textTransform: "uppercase",
                }}
              >
                Free account
              </div>
              <h4 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 600, letterSpacing: -0.3 }}>
                Personalize your feed
              </h4>
              <p
                style={{ margin: "0 0 12px", fontSize: 12, color: "rgba(255,255,255,0.78)", lineHeight: 1.5 }}
              >
                Follow advisors, react to posts, and get a feed tailored to your portfolio.
              </p>
              <Link
                href="/register"
                style={{
                  display: "inline-block",
                  padding: "8px 16px",
                  borderRadius: 8,
                  background: "var(--surface)",
                  color: "#064e3b",
                  fontWeight: 600,
                  fontSize: 12,
                  textDecoration: "none",
                }}
              >
                Get started — free
              </Link>
            </article>
          )}
        </aside>
      </div>

      {/* Report modal */}
      {reportingPost !== null && (
        <ReportModal
          postId={reportingPost}
          onClose={() => {
            setReportedPosts((prev) => new Set([...prev, reportingPost!]));
            setReportingPost(null);
          }}
        />
      )}

      {/* Spin animation */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
