import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth, requireRole } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const userId = auth.userId;

  const body = await parseBody<{
    sebiRegistrationNo?: string;
    experienceYears?: number;
    bio?: string;
    expertiseTags?: string[];
  }>(req);

  if (!body.sebiRegistrationNo) {
    return err("sebiRegistrationNo is required");
  }

  const existing = await prisma.advisorProfile.findUnique({
    where: { userId },
  });
  if (existing) return err("Advisor profile already submitted", 409);

  const profile = await prisma.advisorProfile.create({
    data: {
      userId,
      sebiRegistrationNo: body.sebiRegistrationNo,
      experienceYears: body.experienceYears,
      bio: body.bio,
      expertiseTags: body.expertiseTags || [],
    },
  });

  return ok({ verification_status: profile.verificationStatus, profile });
}
