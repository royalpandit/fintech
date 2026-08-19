/**
 * A person's profile picture lives in one of two places depending on who they
 * are: advisors upload theirs onto `advisor_profiles.profile_image_url`, while
 * ordinary users have `users.avatar_url`. Anything rendering an avatar should
 * select and resolve through here so the two never drift apart.
 */

/** Spread into a Prisma `select` on a User to pull both avatar sources. */
export const userAvatarSelect = {
  avatarUrl: true,
  advisorProfile: { select: { profileImageUrl: true } },
} as const;

type AvatarSource = {
  avatarUrl?: string | null;
  advisorProfile?: { profileImageUrl?: string | null } | null;
} | null | undefined;

/** Advisor picture wins, then the plain user avatar, then null (→ initials). */
export function resolveAvatarUrl(user: AvatarSource): string | null {
  return user?.advisorProfile?.profileImageUrl ?? user?.avatarUrl ?? null;
}
