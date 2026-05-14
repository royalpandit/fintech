import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";

async function getFriendRequest(fromUserId: number, toUserId: number) {
  try {
    return await (prisma as any).friendRequest.findUnique({
      where: { fromUserId_toUserId: { fromUserId, toUserId } },
    });
  } catch {
    return null; // table not yet migrated
  }
}

// POST — send a friend request (or accept if they already sent you one)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const fromUserId = auth.userId;
  const toUserId = Number(params.id);
  if (fromUserId === toUserId) return err("Cannot connect with yourself");

  const target = await prisma.user.findUnique({ where: { id: toUserId }, select: { id: true } });
  if (!target) return err("User not found", 404);

  // Check if they already sent US a request → auto-accept
  const theirRequest = await getFriendRequest(toUserId, fromUserId);
  if (theirRequest && theirRequest.status === "pending") {
    await (prisma as any).friendRequest.update({
      where: { fromUserId_toUserId: { fromUserId: toUserId, toUserId: fromUserId } },
      data: { status: "accepted", updatedAt: new Date() },
    });
    // Create notification for them
    await prisma.notification.create({
      data: {
        userId: toUserId,
        title: "Connection accepted",
        message: `You are now connected. You can now message each other.`,
        channel: "in_app",
      },
    });
    return ok({ status: "accepted" });
  }

  // Check if we already sent a request
  const existing = await getFriendRequest(fromUserId, toUserId);
  if (existing) {
    if (existing.status === "accepted") return ok({ status: "accepted" });
    return ok({ status: "pending_sent" });
  }

  // Send new request
  await (prisma as any).friendRequest.create({
    data: { fromUserId, toUserId, status: "pending" },
  });

  // Notify the target
  const sender = await prisma.user.findUnique({ where: { id: fromUserId }, select: { fullName: true } });
  await prisma.notification.create({
    data: {
      userId: toUserId,
      title: "New connection request",
      message: `${sender?.fullName ?? "Someone"} sent you a connection request.`,
      channel: "in_app",
      data: { type: "friend_request", fromUserId },
    },
  });

  return ok({ status: "pending_sent" });
}

// DELETE — cancel a sent request OR decline a received request
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const myUserId = auth.userId;
  const otherUserId = Number(params.id);

  try {
    // Cancel sent request
    await (prisma as any).friendRequest.deleteMany({
      where: {
        OR: [
          { fromUserId: myUserId, toUserId: otherUserId },
          { fromUserId: otherUserId, toUserId: myUserId, status: "pending" },
        ],
      },
    });
  } catch {
    // Table not yet migrated
  }

  return ok({ cancelled: true });
}
