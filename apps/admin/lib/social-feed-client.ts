import type { CreateSocialPostInput, SocialPost } from "./social-feed-types";

async function parseJson(res: Response) {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(
      res.ok
        ? `Empty response (${res.status})`
        : `Server error (${res.status}) — restart the dev server if this persists`,
    );
  }
  return JSON.parse(text);
}

export async function uploadSocialMedia(
  file: File,
  kind: "image" | "video",
): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("kind", kind);
  const res = await fetch("/api/v1/uploads/social", {
    method: "POST",
    credentials: "include",
    body: fd,
  });
  const json = await parseJson(res);
  if (!res.ok || json.status === false) {
    throw new Error(json.error || "Upload failed");
  }
  return json.url as string;
}

export async function fetchSocialPosts(params?: {
  cursor?: number;
  limit?: number;
}): Promise<{ posts: SocialPost[]; nextCursor: number | null }> {
  const q = new URLSearchParams();
  if (params?.cursor) q.set("cursor", String(params.cursor));
  if (params?.limit) q.set("limit", String(params.limit));
  const res = await fetch(`/api/v1/community/posts?${q}`, {
    credentials: "include",
    cache: "no-store",
  });
  const json = await parseJson(res);
  if (!res.ok) return { posts: [], nextCursor: null };
  return {
    posts: json.posts ?? [],
    nextCursor: json.next_cursor ?? null,
  };
}

export async function createSocialPost(input: CreateSocialPostInput): Promise<SocialPost> {
  const res = await fetch("/api/v1/community/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      content: input.content,
      postType: input.postType ?? "text",
      title: input.title,
      sentiment: input.sentiment,
      targetPrice: input.targetPrice,
      stopLossPrice: input.stopLossPrice,
      thumbnailUrl: input.thumbnailUrl,
      articleBody: input.articleBody,
      imageUrls: input.imageUrls,
      videoUrls: input.videoUrls,
      symbols: input.symbols,
    }),
  });
  const json = await parseJson(res);
  if (!res.ok || json.status === false) {
    throw new Error(json.error || "Failed to create post");
  }
  return json.post as SocialPost;
}

export async function updateSocialPost(
  id: number,
  input: Partial<CreateSocialPostInput>,
): Promise<SocialPost> {
  const res = await fetch(`/api/v1/community/posts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  const json = await parseJson(res);
  if (!res.ok || json.status === false) {
    throw new Error(json.error || "Failed to update post");
  }
  return json.post as SocialPost;
}

export async function deleteSocialPost(id: number): Promise<void> {
  const res = await fetch(`/api/v1/community/posts/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const json = await parseJson(res);
    throw new Error(json.error || "Failed to delete post");
  }
}

export async function toggleSocialPostLike(id: number): Promise<{ liked: boolean; count: number }> {
  const res = await fetch(`/api/v1/community/posts/${id}/like`, {
    method: "POST",
    credentials: "include",
  });
  const json = await parseJson(res);
  if (!res.ok) throw new Error(json.error || "Like failed");
  return { liked: json.liked, count: json.count };
}

export async function toggleSocialPostSave(id: number): Promise<{ saved: boolean }> {
  const res = await fetch(`/api/v1/community/posts/${id}/save`, {
    method: "POST",
    credentials: "include",
  });
  const json = await parseJson(res);
  if (!res.ok) throw new Error(json.error || "Save failed");
  return { saved: json.saved };
}

export type SocialComment = {
  id: number;
  content: string;
  created_at: string;
  user: { fullName: string };
  replies: SocialComment[];
};

export async function fetchSocialComments(postId: number): Promise<SocialComment[]> {
  const res = await fetch(`/api/v1/community/posts/${postId}/comments`, {
    credentials: "include",
  });
  const json = await parseJson(res);
  if (!res.ok) return [];
  return json.comments ?? [];
}

export async function postSocialComment(
  postId: number,
  content: string,
  parentId?: number,
): Promise<SocialComment> {
  const res = await fetch(`/api/v1/community/posts/${postId}/comment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ content, parentId }),
  });
  const json = await parseJson(res);
  if (!res.ok) throw new Error(json.error || "Comment failed");
  return json.comment;
}

export async function reportSocialPost(postId: number, reason: string): Promise<void> {
  const res = await fetch(`/api/v1/community/posts/${postId}/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const json = await parseJson(res);
    throw new Error(json.error || "Report failed");
  }
}
