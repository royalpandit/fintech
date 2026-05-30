import { prisma } from "@/lib/prisma";
import type { CommunityType, JoinRequestStatus, PostPermission, Prisma } from "@prisma/client";

export type GroupRole = "owner" | "admin" | "moderator" | "member";

export const ADMIN_ROLES: GroupRole[] = ["owner", "admin"];
export const MOD_ROLES: GroupRole[] = ["owner", "admin", "moderator"];

export const POST_PERMISSION_DENIED =
  "You do not have permission to create posts in this community.";

export function normalizePostPermission(
  value: PostPermission | null | undefined,
): PostPermission {
  if (value === "everyone" || value === "admins" || value === "owner") return value;
  return "everyone";
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "community";
}

export async function uniqueSlug(base: string): Promise<string> {
  let slug = slugify(base);
  let n = 0;
  while (true) {
    const candidate = n === 0 ? slug : `${slug}-${n}`;
    const exists = await prisma.group.findFirst({
      where: { slug: candidate, deletedAt: null },
      select: { id: true },
    });
    if (!exists) return candidate;
    n += 1;
  }
}

export async function getGroupBySlug(slug: string) {
  return prisma.group.findFirst({
    where: { slug, deletedAt: null },
    include: {
      creator: { select: { id: true, fullName: true, uuid: true } },
      _count: { select: { members: true, posts: { where: { deletedAt: null } } } },
    },
  });
}

export async function getMembership(groupId: number, userId: number | null) {
  if (!userId) return null;
  return prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
}

export async function isBanned(groupId: number, userId: number) {
  const ban = await prisma.groupBan.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  return Boolean(ban);
}

export async function canViewPosts(
  group: { id: number; communityType: CommunityType },
  userId: number | null,
) {
  if (group.communityType === "public") return true;
  if (!userId) return false;
  const member = await getMembership(group.id, userId);
  return Boolean(member);
}

export async function canInteract(
  group: { id: number; communityType: CommunityType },
  userId: number | null,
) {
  if (!userId) return false;
  if (await isBanned(group.id, userId)) return false;
  const member = await getMembership(group.id, userId);
  return Boolean(member);
}

export function hasRole(role: string | undefined, allowed: GroupRole[]) {
  return role != null && allowed.includes(role as GroupRole);
}

export function roleCanCreatePost(
  postPermission: PostPermission | null | undefined,
  role: string | undefined | null,
): boolean {
  if (!role) return false;
  const permission = normalizePostPermission(postPermission);
  if (permission === "everyone") return true;
  if (permission === "admins") return hasRole(role, MOD_ROLES);
  if (permission === "owner") return role === "owner";
  return false;
}

export function getPostPermissionHint(
  postPermission: PostPermission | null | undefined,
): string | null {
  const permission = normalizePostPermission(postPermission);
  if (permission === "everyone") return null;
  if (permission === "admins") {
    return "Only admins and moderators can create posts in this community.";
  }
  return "Only the community owner can create posts in this community.";
}

export async function canUserCreatePost(
  group: { id: number; postPermission?: PostPermission | null },
  userId: number | null,
): Promise<boolean> {
  if (!userId) return false;
  if (await isBanned(group.id, userId)) return false;
  const member = await getMembership(group.id, userId);
  if (!member) return false;
  return roleCanCreatePost(group.postPermission, member.role);
}

export async function notifyUser(
  userId: number,
  title: string,
  message: string,
  data?: Prisma.InputJsonValue,
) {
  await prisma.notification.create({
    data: {
      userId,
      title,
      message,
      channel: "in_app",
      data: data ?? undefined,
    },
  });
}

export async function notifyGroupAdmins(
  groupId: number,
  title: string,
  message: string,
  data?: Prisma.InputJsonValue,
) {
  const admins = await prisma.groupMember.findMany({
    where: { groupId, role: { in: ["owner", "admin"] } },
    select: { userId: true },
  });
  await Promise.all(
    admins.map((a) => notifyUser(a.userId, title, message, data)),
  );
}

export type SerializedCommunity = {
  id: number;
  uuid: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  community_type: CommunityType;
  post_permission: PostPermission;
  rules: string | null;
  created_by: number;
  created_at: string;
  member_count: number;
  post_count: number;
  creator: { id: number; fullName: string; uuid: string };
  my_role: GroupRole | null;
  my_join_status: JoinRequestStatus | "member" | null;
  can_view_posts: boolean;
  can_interact: boolean;
  can_create_post: boolean;
  post_permission_hint: string | null;
};

export async function serializeCommunity(
  group: {
    id: number;
    uuid: string;
    slug: string;
    name: string;
    description: string | null;
    logoUrl: string | null;
    bannerUrl: string | null;
    communityType: CommunityType;
    postPermission: PostPermission;
    rules: string | null;
    createdBy: number;
    createdAt: Date;
    creator: { id: number; fullName: string; uuid: string };
    _count: { members: number; posts: number };
  },
  userId: number | null,
): Promise<SerializedCommunity> {
  const [member, joinReq, viewPosts, interact, createPost] = await Promise.all([
    getMembership(group.id, userId),
    userId
      ? prisma.groupJoinRequest.findUnique({
          where: { groupId_userId: { groupId: group.id, userId } },
        })
      : null,
    canViewPosts(group, userId),
    canInteract(group, userId),
    canUserCreatePost(group, userId),
  ]);

  let myJoinStatus: JoinRequestStatus | "member" | null = null;
  if (member) myJoinStatus = "member";
  else if (joinReq) myJoinStatus = joinReq.status;

  const postPermission = normalizePostPermission(group.postPermission);

  return {
    id: group.id,
    uuid: group.uuid,
    slug: group.slug,
    name: group.name,
    description: group.description,
    logo_url: group.logoUrl,
    banner_url: group.bannerUrl,
    community_type: group.communityType,
    post_permission: postPermission,
    rules: group.rules,
    created_by: group.createdBy,
    created_at: group.createdAt.toISOString(),
    member_count: group._count.members,
    post_count: group._count.posts,
    creator: group.creator,
    my_role: (member?.role as GroupRole) ?? null,
    my_join_status: myJoinStatus,
    can_view_posts: viewPosts,
    can_interact: interact,
    can_create_post: createPost,
    post_permission_hint: createPost ? null : getPostPermissionHint(postPermission),
  };
}

export const communityInclude = {
  creator: { select: { id: true, fullName: true, uuid: true } },
  _count: { select: { members: true, posts: { where: { deletedAt: null } } } },
} as const;
