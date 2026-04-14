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

  const postId = Number(params.id);
  const body = await parseBody<{
    action?: "approve" | "flag" | "reject";
    notes?: string;
  }>(req);

  const statusMap: Record<string, string> = {
    approve: "approved",
    flag: "flagged",
    reject: "rejected",
  };
  const newStatus = statusMap[body.action || "approve"] || "approved";

  await prisma.marketPost.update({
    where: { id: postId },
    data: { complianceStatus: newStatus as any },
  });

  await prisma.complianceLog.create({
    data: {
      module: "market_post",
      referenceId: postId,
      status: newStatus as any,
      notes: body.notes,
      createdBy: "admin",
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: adminId,
      action: `post_${newStatus}`,
      module: "market_posts",
      targetKind: "market_post",
      targetId: postId,
    },
  });

  return ok({ post_id: postId, moderation: { status: newStatus, notes: body.notes } });
}
