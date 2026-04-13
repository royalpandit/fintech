import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = Number(req.headers.get("x-user-id"));
  if (!userId) return err("Unauthorized", 401);

  const profile = await prisma.advisorProfile.findUnique({
    where: { userId },
    select: {
      verificationStatus: true,
      sebiRegistrationNo: true,
      rejectionReason: true,
      verifiedAt: true,
    },
  });

  if (!profile) return err("No advisor profile found", 404);
  return ok({ verification_status: profile.verificationStatus, profile });
}
