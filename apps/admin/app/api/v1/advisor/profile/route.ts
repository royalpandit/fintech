import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: {
      id: true,
      uuid: true,
      fullName: true,
      email: true,
      phone: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
      advisorProfile: {
        select: {
          sebiRegistrationNo: true,
          experienceYears: true,
          bio: true,
          expertiseTags: true,
          profileImageUrl: true,
          verificationStatus: true,
          verifiedAt: true,
        },
      },
    },
  });

  if (!user) return err("User not found", 404);
  return ok({ user });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);

  const body = await parseBody<{
    bio?: string;
    expertiseTags?: string[];
    profileImageUrl?: string | null;
    experienceYears?: number;
    fullName?: string;
  }>(req);

  const profileData: Record<string, unknown> = {};
  const userData: Record<string, unknown> = {};

  if (typeof body.bio === "string") {
    profileData.bio = body.bio.trim() || null;
  }
  if (Array.isArray(body.expertiseTags)) {
    const cleaned = body.expertiseTags
      .map((t) => (typeof t === "string" ? t.trim() : ""))
      .filter(Boolean)
      .slice(0, 10);
    profileData.expertiseTags = cleaned;
  }
  if ("profileImageUrl" in body) {
    profileData.profileImageUrl = body.profileImageUrl?.trim() || null;
  }
  if (typeof body.experienceYears === "number" && body.experienceYears >= 0) {
    profileData.experienceYears = body.experienceYears;
  }
  if (typeof body.fullName === "string") {
    const trimmed = body.fullName.trim();
    if (trimmed.length < 2) return err("Full name too short");
    userData.fullName = trimmed;
  }

  const [user, profile] = await Promise.all([
    Object.keys(userData).length > 0
      ? prisma.user.update({
          where: { id: auth.userId },
          data: userData,
          select: { fullName: true, email: true },
        })
      : null,
    Object.keys(profileData).length > 0
      ? prisma.advisorProfile.update({
          where: { userId: auth.userId },
          data: profileData,
        })
      : null,
  ]);

  return ok({ user, profile });
}
