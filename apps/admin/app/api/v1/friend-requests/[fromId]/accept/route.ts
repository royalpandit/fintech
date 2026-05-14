import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";

// POST — accept a pending friend request from the given user
export async function POST(
  req: NextRequest,
  { params }: { params: { fromId: string } },
) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const toUserId = auth.userId;
  const fromUserId = Number(params.fromId);

  try {
    const request = await (prisma as any).friendRequest.findUnique({
      where: { fromUserId_toUserId: { fromUserId, toUserId } },
    });
    if (!request || request.status !== "pending") return err("No pending request found", 404);

    await (prisma as any).friendRequest.update({
      where: { fromUserId_toUserId: { fromUserId, toUserId } },
      data: { status: "accepted", updatedAt: new Date() },
    });

    // Notify the sender
    const accepter = await prisma.user.findUnique({ where: { id: toUserId }, select: { fullName: true } });
    await prisma.notification.create({
      data: {
        userId: fromUserId,
        title: "Connection accepted",
        message: `${accepter?.fullName ?? "Someone"} accepted your connection request. You can now message each other.`,
        channel: "in_app",
        data: { type: "friend_accepted", fromUserId: toUserId },
      },
    });

    return ok({ accepted: true });
  } catch {
    return err("Could not accept request. Please try again later.", 500);
  }
}
