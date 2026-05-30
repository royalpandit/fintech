"use client";

import { useState } from "react";
import { FiChevronDown, FiChevronRight, FiMessageSquare } from "react-icons/fi";
import type { CommunityComment } from "@/lib/community-client";
import { addComment, fetchComments } from "@/lib/community-client";
import { formatRelativeTime } from "@/lib/format-date";

function CommentNode({
  comment,
  slug,
  postId,
  depth,
  canInteract,
  onReplyAdded,
}: {
  comment: CommunityComment;
  slug: string;
  postId: number;
  depth: number;
  canInteract: boolean;
  onReplyAdded: () => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replies, setReplies] = useState<CommunityComment[]>(comment.replies ?? []);
  const [loadingMore, setLoadingMore] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  async function submitReply() {
    if (!replyText.trim()) return;
    const data = await addComment(slug, postId, replyText.trim(), comment.id);
    setReplies((prev) => [...prev, { ...data.comment, replies: data.comment.replies ?? [] }]);
    setReplyText("");
    setShowReply(false);
    setExpanded(true);
    onReplyAdded();
  }

  async function loadMoreReplies() {
    setLoadingMore(true);
    try {
      const data = await fetchComments(slug, postId, comment.id);
      setReplies(
        data.comments.map((c) => ({ ...c, replies: c.replies ?? [] })),
      );
    } finally {
      setLoadingMore(false);
    }
  }

  if (collapsed) {
    return (
      <button type="button" className="comm-thread-collapsed" onClick={() => setCollapsed(false)}>
        <FiMessageSquare size={12} /> {comment.reply_count} more replies — expand
      </button>
    );
  }

  return (
    <div className="comm-thread-node" style={{ marginLeft: depth * 16 }}>
      <div className="comm-thread-comment">
        <button type="button" className="comm-thread-toggle" onClick={() => setCollapsed(true)}>
          {expanded ? <FiChevronDown size={12} /> : <FiChevronRight size={12} />}
        </button>
        <div className="comm-thread-body">
          <div className="comm-thread-meta">
            <strong>{comment.user.fullName}</strong>
            <span>{formatRelativeTime(comment.created_at)}</span>
          </div>
          <p>{comment.content}</p>
          {canInteract && (
            <button type="button" className="comm-inline-btn" onClick={() => setShowReply(!showReply)}>
              Reply
            </button>
          )}
          {showReply && (
            <div className="comm-reply-box">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply..."
                rows={2}
              />
              <button type="button" className="comm-btn comm-btn-primary comm-btn-sm" onClick={() => void submitReply()}>
                Reply
              </button>
            </div>
          )}
        </div>
      </div>
      {expanded && replies.length > 0 && (
        <div className="comm-thread-children">
          {replies.map((r) => (
            <CommentNode
              key={r.id}
              comment={r}
              slug={slug}
              postId={postId}
              depth={depth + 1}
              canInteract={canInteract}
              onReplyAdded={onReplyAdded}
            />
          ))}
        </div>
      )}
      {expanded && comment.reply_count > replies.length && (
        <button type="button" className="comm-load-more-replies" onClick={() => void loadMoreReplies()} disabled={loadingMore}>
          {loadingMore ? "Loading..." : `Load ${comment.reply_count - replies.length} more replies`}
        </button>
      )}
    </div>
  );
}

export default function CommentThread({
  slug,
  postId,
  initialComments,
  canInteract,
}: {
  slug: string;
  postId: number;
  initialComments: CommunityComment[];
  canInteract: boolean;
}) {
  const [comments, setComments] = useState(initialComments);
  const [newComment, setNewComment] = useState("");

  async function submitTopLevel() {
    if (!newComment.trim()) return;
    const data = await addComment(slug, postId, newComment.trim());
    setComments((prev) => [...prev, { ...data.comment, replies: [] }]);
    setNewComment("");
  }

  return (
    <div className="comm-thread">
      <h3>Comments</h3>
      {canInteract && (
        <div className="comm-comment-composer">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            rows={3}
          />
          <button type="button" className="comm-btn comm-btn-primary" onClick={() => void submitTopLevel()}>
            Comment
          </button>
        </div>
      )}
      <div className="comm-thread-list">
        {comments.map((c) => (
          <CommentNode
            key={c.id}
            comment={c}
            slug={slug}
            postId={postId}
            depth={0}
            canInteract={canInteract}
            onReplyAdded={() => {}}
          />
        ))}
      </div>
    </div>
  );
}
