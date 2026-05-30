import type { SerializedCommunity } from "@/lib/community";
import type { SocialPost } from "@/lib/social-feed-types";

export type CommunityTab = "home" | "popular" | "joined" | "mine";
export type CommunitySort = "latest" | "liked" | "commented" | "trending";

export type CommunityComment = {
  id: number;
  content: string;
  created_at: string;
  user: { id: number; fullName: string };
  parent_id: number | null;
  reply_count: number;
  replies: CommunityComment[];
  is_own?: boolean;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    credentials: "include",
  });
  const data = await res.json();
  if (!data.status) throw new Error(data.error ?? "Request failed");
  return data as T;
}

export async function fetchCommunities(opts: {
  tab?: CommunityTab;
  sort?: CommunitySort;
  type?: "public" | "private";
  q?: string;
  cursor?: number;
}) {
  const params = new URLSearchParams();
  if (opts.tab) params.set("tab", opts.tab);
  if (opts.sort) params.set("sort", opts.sort);
  if (opts.type) params.set("type", opts.type);
  if (opts.q) params.set("q", opts.q);
  if (opts.cursor) params.set("cursor", String(opts.cursor));
  return api<{ communities: SerializedCommunity[]; next_cursor: number | null }>(
    `/api/v1/communities?${params}`,
  );
}

export async function searchCommunities(q: string, type?: "public" | "private") {
  const params = new URLSearchParams({ q });
  if (type) params.set("type", type);
  return api<{
    communities: SerializedCommunity[];
    posts: { id: number; title: string | null; content: string; community: { slug: string; name: string } | null }[];
    users: { id: number; fullName: string; uuid: string }[];
  }>(`/api/v1/communities/search?${params}`);
}

export async function fetchCommunity(slug: string) {
  return api<{ community: SerializedCommunity }>(`/api/v1/communities/${slug}`);
}

export async function createCommunity(body: {
  name: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  communityType?: "public" | "private";
  rules?: string;
}) {
  return api<{ community: SerializedCommunity }>("/api/v1/communities", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateCommunity(
  slug: string,
  body: Partial<{
    name: string;
    description: string;
    logoUrl: string;
    bannerUrl: string;
    communityType: "public" | "private";
    postPermission: "everyone" | "admins" | "owner";
    rules: string;
  }>,
) {
  return api<{ community: SerializedCommunity }>(`/api/v1/communities/${slug}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function joinCommunity(slug: string) {
  return api<{ status: string; community?: SerializedCommunity }>(
    `/api/v1/communities/${slug}/join`,
    { method: "POST" },
  );
}

export async function leaveCommunity(slug: string) {
  return api<{ status: string }>(`/api/v1/communities/${slug}/join`, { method: "DELETE" });
}

export async function fetchCommunityPosts(
  slug: string,
  opts?: { sort?: CommunitySort; cursor?: number },
) {
  const params = new URLSearchParams();
  if (opts?.sort) params.set("sort", opts.sort);
  if (opts?.cursor) params.set("cursor", String(opts.cursor));
  return api<{ posts: SocialPost[]; next_cursor: number | null }>(
    `/api/v1/communities/${slug}/posts?${params}`,
  );
}

export async function createCommunityPost(
  slug: string,
  body: {
    title?: string;
    content?: string;
    postType?: string;
    imageUrls?: string[];
    videoUrls?: string[];
    linkUrl?: string;
  },
) {
  return api<{ post: SocialPost }>(`/api/v1/communities/${slug}/posts`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchCommunityPost(slug: string, postId: number) {
  return api<{ post: SocialPost }>(`/api/v1/communities/${slug}/posts/${postId}`);
}

export async function likeCommunityPost(slug: string, postId: number) {
  const data = await api<{ liked: boolean; count: number }>(
    `/api/v1/community/posts/${postId}/like`,
    { method: "POST" },
  );
  return { liked: data.liked, like_count: data.count };
}

export async function shareCommunityPost(slug: string, postId: number) {
  return api<{ share_count: number }>(
    `/api/v1/communities/${slug}/posts/${postId}/share`,
    { method: "POST" },
  );
}

export async function pinCommunityPost(slug: string, postId: number) {
  return api<{ pinned: boolean }>(
    `/api/v1/communities/${slug}/posts/${postId}/pin`,
    { method: "POST" },
  );
}

export async function fetchComments(slug: string, postId: number, parentId?: number | null, cursor?: number) {
  const params = new URLSearchParams();
  if (parentId != null) params.set("parent_id", String(parentId));
  if (cursor) params.set("cursor", String(cursor));
  return api<{ comments: CommunityComment[]; next_cursor?: number | null }>(
    `/api/v1/communities/${slug}/posts/${postId}/comments?${params}`,
  );
}

export async function addComment(
  slug: string,
  postId: number,
  content: string,
  parentId?: number,
) {
  return api<{ comment: CommunityComment }>(
    `/api/v1/communities/${slug}/posts/${postId}/comments`,
    { method: "POST", body: JSON.stringify({ content, parentId }) },
  );
}

export async function fetchJoinRequests(slug: string, status = "pending") {
  return api<{
    requests: {
      id: number;
      status: string;
      created_at: string;
      user: { id: number; fullName: string; uuid: string; email: string };
    }[];
  }>(`/api/v1/communities/${slug}/requests?status=${status}`);
}

export async function reviewJoinRequest(
  slug: string,
  userId: number,
  action: "approve" | "reject",
) {
  return api<{ status: string }>(
    `/api/v1/communities/${slug}/requests/${userId}`,
    { method: "POST", body: JSON.stringify({ action }) },
  );
}

export async function fetchMembers(slug: string) {
  return api<{
    members: {
      user_id: number;
      role: string;
      joined_at: string;
      user: { id: number; fullName: string; uuid: string; role: string };
      is_me: boolean;
    }[];
  }>(`/api/v1/communities/${slug}/members`);
}

export async function uploadSocialFile(file: File, kind: "image" | "video") {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("kind", kind);
  const res = await fetch("/api/v1/uploads/social", { method: "POST", body: fd, credentials: "include" });
  const data = await res.json();
  if (!data.status) throw new Error(data.error ?? "Upload failed");
  return data.url as string;
}
