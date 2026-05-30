export type PostAccessType = "free" | "paid";

const VALID: PostAccessType[] = ["free", "paid"];

export function parsePostAccessType(value: unknown): PostAccessType | null {
  if (typeof value !== "string") return null;
  const v = value.toLowerCase().trim() as PostAccessType;
  return VALID.includes(v) ? v : null;
}

export function requirePostAccessType(value: unknown): PostAccessType {
  const parsed = parsePostAccessType(value);
  if (!parsed) throw new Error("postAccessType must be 'free' or 'paid'");
  return parsed;
}

/** Paid posts stay locked until the user unlocks (including the author, for feed preview). */
export function isPostLocked(opts: {
  postAccessType: string;
  isUnlocked: boolean;
  /** @deprecated No longer skips lock for own posts — kept for call-site compatibility */
  isOwn?: boolean;
}): boolean {
  return opts.postAccessType === "paid" && !opts.isUnlocked;
}

export function previewText(text: string, maxLen = 140): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen).trim()}…`;
}

/** Strip full content for locked paid posts in API responses */
export function applyContentLock<T extends {
  post_access_type: PostAccessType;
  is_locked: boolean;
  content: string;
  article_body?: string | null;
}>(post: T): T {
  if (!post.is_locked) return post;
  return {
    ...post,
    content: previewText(post.content),
    article_body: post.article_body ? previewText(post.article_body) : post.article_body,
  };
}
