"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
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

function relTime(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

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
          fontWeight: 800,
          flexShrink: 0,
        }}
      >
        {getInitials(comment.user.fullName)}
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            background: "#f8fafc",
            borderRadius: "0 10px 10px 10px",
            padding: "8px 12px",
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, color: "#0f172a" }}>
            {comment.user.fullName}
          </span>
          <p style={{ margin: "3px 0 0", fontSize: 13, color: "#334155", lineHeight: 1.45 }}>
            {comment.deletedAt ? (
              <em style={{ color: "#94a3b8" }}>Comment removed</em>
            ) : (
              comment.content
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 4, paddingLeft: 4 }}>
          <span style={{ fontSize: 10, color: "#94a3b8" }}>
            {relTime(comment.createdAt)}
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
  const menuRef = useRef<HTMLDivElement>(null);
  const sColor = SENTIMENT_COLORS[post.sentiment] ?? "#64748b";
  const initials = getInitials(post.advisor?.fullName ?? "??");
  const when = post.publishedAt ?? post.createdAt;

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
        background: "#fff",
        border: "1px solid #eef0f4",
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
            fontWeight: 800,
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
              style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", textDecoration: "none" }}
            >
              {post.advisor?.fullName}
            </Link>
            <CheckCircle size={12} style={{ color: "#10b981" }} />
          </div>
          <div style={{ fontSize: 11, color: "#64748b" }}>
            {post.advisor?.advisorProfile?.sebiRegistrationNo} · {relTime(when)}
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
              border: following ? "1px solid #e2e8f0" : "1px solid #0ea5e9",
              background: following ? "#f8fafc" : "rgba(14,165,233,0.08)",
              color: following ? "#64748b" : "#0ea5e9",
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
            fontWeight: 800,
            letterSpacing: 0.5,
            textTransform: "uppercase",
            flexShrink: 0,
          }}
        >
          {post.sentiment}
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
              color: "#94a3b8",
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
                background: "#fff",
                border: "1px solid #eef0f4",
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
                <div style={{ padding: "10px 14px", fontSize: 12, color: "#94a3b8" }}>
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
                    color: "#475569",
                    cursor: "pointer",
                    textAlign: "left",
                    borderTop: "1px solid #f1f5f9",
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
      <Link
        href={`/user/markets/${post.id}`}
        style={{ textDecoration: "none", color: "inherit" }}
      >
        <h3
          style={{
            margin: "0 0 8px",
            fontSize: 17,
            fontWeight: 700,
            color: "#0f172a",
            letterSpacing: -0.2,
          }}
        >
          {post.title}
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: "#334155",
            lineHeight: 1.55,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {post.content}
        </p>
      </Link>

      {/* Tags */}
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        {post.marketSymbol && (
          <span
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              background: "#f1f5f9",
              color: "#334155",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {post.marketSymbol}
          </span>
        )}
        <span
          style={{
            padding: "4px 10px",
            borderRadius: 999,
            background: "#f1f5f9",
            color: "#334155",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {post.assetType.toUpperCase()}
        </span>
        <span
          style={{
            padding: "4px 10px",
            borderRadius: 999,
            background:
              post.riskLevel === "high"
                ? "#fee2e2"
                : post.riskLevel === "medium"
                  ? "#fef3c7"
                  : "#d1fae5",
            color:
              post.riskLevel === "high"
                ? "#991b1b"
                : post.riskLevel === "medium"
                  ? "#92400e"
                  : "#047857",
            fontSize: 11,
            fontWeight: 700,
            textTransform: "capitalize",
          }}
        >
          {post.riskLevel} risk
        </span>
      </div>

      {/* Action bar */}
      <div
        style={{
          marginTop: 14,
          paddingTop: 14,
          borderTop: "1px solid #eef0f4",
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
            color: liked ? "#e11d48" : "#64748b",
            fontSize: 12,
            fontWeight: 600,
            cursor: isAuthed ? "pointer" : "default",
            transition: "color 0.15s",
          }}
        >
          <FiHeart
            size={13}
            style={{ fill: liked ? "#e11d48" : "none", color: liked ? "#e11d48" : "#64748b" }}
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
            color: expanded ? "#0ea5e9" : "#64748b",
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
        <div style={{ marginTop: 14, borderTop: "1px solid #f1f5f9", paddingTop: 14 }}>
          {commentsLoading ? (
            <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>Loading comments…</p>
          ) : comments.length === 0 ? (
            <p style={{ margin: "0 0 12px", fontSize: 12, color: "#94a3b8" }}>
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
                          border: "1px solid #e2e8f0",
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
                          color: "#94a3b8",
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
                  border: "1px solid #e2e8f0",
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
            <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
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
          background: "#fff",
          borderRadius: 18,
          padding: 28,
          boxShadow: "0 24px 80px rgba(15,23,42,0.18)",
        }}
      >
        {done ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>✓</div>
            <p style={{ margin: 0, fontWeight: 700, color: "#0f172a" }}>Report submitted</p>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b" }}>
              Our team will review it shortly.
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0f172a" }}>
                Report this post
              </h3>
              <button
                type="button"
                onClick={onClose}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
              >
                <FiX size={18} />
              </button>
            </div>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "#64748b" }}>
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
                    border: `1px solid ${reason === r ? "#0ea5e9" : "#e2e8f0"}`,
                    background: reason === r ? "rgba(14,165,233,0.06)" : "#fff",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#334155",
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
                background: reason ? "#dc2626" : "#e2e8f0",
                color: reason ? "#fff" : "#94a3b8",
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
        color: "#94a3b8",
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

  const hasFollowed = initialFollowedPosts.length > 0;

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: 18,
          alignItems: "start",
        }}
      >
        {/* Feed column */}
        <div>
          <div style={{ marginBottom: 16 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 800,
                color: "#0f172a",
                letterSpacing: -0.5,
              }}
            >
              Your Feed
            </h1>
            <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 12 }}>
              {isAuthed
                ? hasFollowed
                  ? "Latest from advisors you follow, then top picks across the network"
                  : "Discover SEBI-verified advisors. Follow to personalize your feed."
                : "A live timeline of sentiment from SEBI-verified advisors"}
            </p>
          </div>

          {/* Following section */}
          {hasFollowed && (
            <>
              <SectionLabel>Following</SectionLabel>
              <div style={{ display: "grid", gap: 12, marginBottom: 20 }}>
                {initialFollowedPosts.map(renderPost)}
              </div>
              <SectionLabel>Discover</SectionLabel>
            </>
          )}

          {/* Discover / global */}
          <div style={{ display: "grid", gap: 12 }}>
            {discoverPosts.length === 0 && !loadingMore ? (
              <article
                style={{
                  background: "#fff",
                  border: "1px solid #eef0f4",
                  borderRadius: 14,
                  padding: 32,
                  textAlign: "center",
                  color: "#94a3b8",
                  fontSize: 13,
                }}
              >
                No posts yet — check back soon.
              </article>
            ) : (
              discoverPosts.map(renderPost)
            )}
          </div>

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} style={{ height: 1 }} />

          {loadingMore && (
            <div
              style={{
                textAlign: "center",
                padding: "20px 0",
                color: "#94a3b8",
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
                  border: "2px solid #e2e8f0",
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
                color: "#94a3b8",
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
              background: "#fff",
              border: "1px solid #eef0f4",
              borderRadius: 14,
              padding: 16,
            }}
          >
            <h3 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
              Suggested advisors
            </h3>
            {suggestedAdvisors.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>No suggestions right now.</p>
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
                          fontWeight: 800,
                          flexShrink: 0,
                          textDecoration: "none",
                        }}
                      >
                        {getInitials(sa.user?.fullName ?? "??")}
                      </Link>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: "#0f172a" }}
                        >
                          {sa.user?.fullName}
                          <CheckCircle size={11} style={{ color: "#10b981" }} />
                        </div>
                        <div style={{ fontSize: 10, color: "#64748b" }}>
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
                            border: isFollowing ? "1px solid #e2e8f0" : "1px solid #0ea5e9",
                            background: isFollowing ? "#f8fafc" : "rgba(14,165,233,0.08)",
                            color: isFollowing ? "#64748b" : "#0ea5e9",
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
                background: "#f1f5f9",
                color: "#0f172a",
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
              background: "#fff",
              border: "1px solid #eef0f4",
              borderRadius: 14,
              padding: 16,
            }}
          >
            <h3
              style={{
                margin: "0 0 12px",
                fontSize: 13,
                fontWeight: 700,
                color: "#0f172a",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <FiTrendingUp size={14} /> Trending this week
            </h3>
            {trendingSymbols.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>Nothing trending yet.</p>
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
                      background: "#f8fafc",
                      textDecoration: "none",
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                      {s.marketSymbol}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b" }}>
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
              <h4 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800, letterSpacing: -0.3 }}>
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
                  background: "#fff",
                  color: "#064e3b",
                  fontWeight: 800,
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
