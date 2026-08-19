import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";
import { notifyAdvisorPost, notifyPostModeration } from "@/lib/notify";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireRole(req, ["admin", "super_admin"]);
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

  const existing = await prisma.marketPost.findUnique({
    where: { id: postId },
    select: {
      publishedAt: true,
      title: true,
      advisorUserId: true,
      entryPriceMin: true,
      targetPrice: true,
      stopLossPrice: true,
      advisor: { select: { fullName: true } },
    },
  });
  if (!existing) return err("Post not found", 404);

  // First approval is what makes a post live.
  const goesLiveNow = newStatus === "approved" && !existing.publishedAt;

  await prisma.marketPost.update({
    where: { id: postId },
    data: {
      complianceStatus: newStatus as any,
      // Stamp publishedAt the first time a post becomes approved so the user
      // feed (ordered by publishedAt desc) shows it in the right slot.
      publishedAt: goesLiveNow ? new Date() : undefined,
    },
  });

  // Tell the advisor what happened — before this, a post could sit in Pending
  // and be approved or rejected with no word either way.
  await notifyPostModeration({
    advisorUserId: existing.advisorUserId,
    postId,
    postTitle: existing.title,
    status: newStatus,
    notes: body.notes ?? null,
  });

  // Fan out to followers only when the post actually goes live. Posts used to be
  // auto-approved at creation, so the create route owned this; now that they can
  // wait in Pending, approval is the moment their audience should hear about it.
  if (goesLiveNow) {
    await notifyAdvisorPost({
      advisorUserId: existing.advisorUserId,
      advisorName: existing.advisor?.fullName ?? "An advisor you follow",
      postId,
      postTitle: existing.title,
      isTrade:
        existing.entryPriceMin != null ||
        existing.targetPrice != null ||
        existing.stopLossPrice != null,
    });
  }

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
