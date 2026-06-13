import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET — list the current user's DM threads with partner info + last message
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const userId = auth.userId;

  const threads = await prisma.dmThread.findMany({
    where: { participants: { some: { userId } } },
    orderBy: { createdAt: "desc" },
    include: {
      participants: {
        include: { user: { select: { id: true, fullName: true } } },
      },
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const data = threads.map((t) => ({
    id: t.id,
    createdAt: t.createdAt,
    partner: t.participants.find((p) => p.userId !== userId)?.user ?? null,
    lastMessage: t.messages[0] ?? null,
  }));

  return ok({ data });
}

// POST — find or create a 1-to-1 thread with another user
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const userId = auth.userId;

  const body = await parseBody<{ targetUserId?: number }>(req);
  const targetUserId = Number(body.targetUserId);
  if (!targetUserId || targetUserId === userId) return err("Invalid targetUserId");

  // Check target exists
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, role: true },
  });
  if (!target) return err("User not found", 404);

  // ── Access gate ──────────────────────────────────────────
  // Advisors: only users with an active monthly/yearly subscription can message
  // Regular users: need an accepted friend/connection request
  if (target.role === "advisor") {
    const sub = await prisma.subscription.findUnique({
      where: { userId_advisorUserId: { userId, advisorUserId: targetUserId } },
      select: { status: true, endDate: true },
    });
    const active = sub?.status === "active" && sub.endDate && new Date(sub.endDate) > new Date();
    if (!active) {
      return err("Subscribe (monthly or yearly) to message this advisor", 403);
    }
  } else {
    let canMessage = false;
    try {
      const accepted = await (prisma as any).friendRequest.findFirst({
        where: {
          OR: [
            { fromUserId: userId, toUserId: targetUserId, status: "accepted" },
            { fromUserId: targetUserId, toUserId: userId, status: "accepted" },
          ],
        },
      });
      canMessage = Boolean(accepted);
    } catch {
      // Table not yet migrated — block for safety
      canMessage = false;
    }
    if (!canMessage) {
      return err("You must be connected to message this person. Send a connection request first.", 403);
    }
  }

  // Find existing thread between the two users
  const existing = await prisma.dmThread.findFirst({
    where: {
      AND: [
        { participants: { some: { userId } } },
        { participants: { some: { userId: targetUserId } } },
      ],
    },
  });

  if (existing) return ok({ threadId: existing.id, created: false });

  // Create new thread + add both participants
  const thread = await prisma.dmThread.create({
    data: {
      participants: {
        create: [{ userId }, { userId: targetUserId }],
      },
    },
  });

  return ok({ threadId: thread.id, created: true });
}
