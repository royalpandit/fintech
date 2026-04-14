import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth, requireRole } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const userId = auth.userId;

  const advisorId = Number(params.id);
  const body = await parseBody<{ amount?: number }>(req);

  const advisor = await prisma.user.findFirst({
    where: { id: advisorId, role: "advisor" },
  });
  if (!advisor) return err("Advisor not found", 404);

  const subscription = await prisma.subscription.upsert({
    where: {
      userId_advisorUserId: { userId, advisorUserId: advisorId },
    },
    update: { status: "active" },
    create: {
      userId,
      advisorUserId: advisorId,
      amount: body.amount || 0,
      status: "active",
    },
  });

  return ok({
    advisor_id: advisorId,
    subscription_status: subscription.status,
  });
}
