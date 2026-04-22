import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: {
      id: true,
      uuid: true,
      fullName: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      emailVerifiedAt: true,
      lastLoginAt: true,
      createdAt: true,
      advisorProfile: {
        select: {
          sebiRegistrationNo: true,
          experienceYears: true,
          bio: true,
          verificationStatus: true,
          verifiedAt: true,
          rejectionReason: true,
        },
      },
    },
  });

  if (!user) return err("User not found", 404);
  if (user.status === "suspended") return err("Account suspended", 403);

  return ok({ user });
}
