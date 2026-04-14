import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireRole(req, ["admin"]);
  if (!auth) return err("Forbidden", 403);

  const adminId = auth.userId;
  const advisorUserId = Number(params.id);
  const body = await parseBody<{
    action?: "approve" | "reject";
    reason?: string;
  }>(req);

  const status = body.action === "reject" ? "rejected" : "approved";

  const profile = await prisma.advisorProfile.update({
    where: { userId: advisorUserId },
    data: {
      verificationStatus: status as any,
      verifiedByAdminId: adminId,
      verifiedAt: new Date(),
      rejectionReason: body.action === "reject" ? body.reason : null,
    },
  });

  if (status === "approved") {
    await prisma.user.update({
      where: { id: advisorUserId },
      data: { role: "advisor" },
    });
  }

  await prisma.auditLog.create({
    data: {
      actorUserId: adminId,
      action: `advisor_${status}`,
      module: "advisors",
      targetKind: "advisor_profile",
      targetId: profile.id,
    },
  });

  return ok({ advisor_id: advisorUserId, verification_status: status });
}
