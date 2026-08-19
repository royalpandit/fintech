import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { userAvatarSelect, resolveAvatarUrl } from "@/lib/user-avatar";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_RESULTS = 50;

// GET /api/v1/messages/search?q=…
// Searches the full message history of every thread the user belongs to, plus
// the names of the people they're talking to.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const userId = auth.userId;

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return ok({ data: [] });

  // Threads this user participates in — the only ones they may search.
  const myThreads = await prisma.dmThreadParticipant.findMany({
    where: { userId },
    select: { threadId: true },
  });
  const threadIds = myThreads.map((t) => t.threadId);
  if (threadIds.length === 0) return ok({ data: [] });

  const [messageHits, nameHits] = await Promise.all([
    prisma.dmMessage.findMany({
      where: {
        threadId: { in: threadIds },
        deletedAt: null,
        contentEnc: { contains: q, mode: "insensitive" },
      },
      orderBy: { createdAt: "desc" },
      take: MAX_RESULTS,
      select: {
        id: true,
        threadId: true,
        contentEnc: true,
        senderUserId: true,
        createdAt: true,
      },
    }),
    // Conversations whose partner's name matches.
    prisma.dmThreadParticipant.findMany({
      where: {
        threadId: { in: threadIds },
        userId: { not: userId },
        user: { fullName: { contains: q, mode: "insensitive" } },
      },
      select: { threadId: true, user: { select: { fullName: true, ...userAvatarSelect } } },
      take: MAX_RESULTS,
    }),
  ]);

  // Partner name for every thread we're about to return.
  const involved = [
    ...new Set([...messageHits.map((m) => m.threadId), ...nameHits.map((n) => n.threadId)]),
  ];
  const partners = await prisma.dmThreadParticipant.findMany({
    where: { threadId: { in: involved }, userId: { not: userId } },
    select: { threadId: true, user: { select: { fullName: true, ...userAvatarSelect } } },
  });
  const nameByThread = new Map(
    partners.map((p) => [p.threadId, p.user?.fullName ?? "Unknown"]),
  );
  const avatarByThread = new Map(
    partners.map((p) => [p.threadId, resolveAvatarUrl(p.user)]),
  );

  type Row = {
    threadId: number;
    partnerName: string;
    partnerAvatar: string | null;
    snippet: string;
    createdAt: string | null;
    matchedIn: "message" | "name";
  };

  const rows: Row[] = messageHits.map((m) => ({
    threadId: m.threadId,
    partnerName: nameByThread.get(m.threadId) ?? "Unknown",
    partnerAvatar: avatarByThread.get(m.threadId) ?? null,
    snippet: m.senderUserId === userId ? `You: ${m.contentEnc}` : m.contentEnc,
    createdAt: m.createdAt.toISOString(),
    matchedIn: "message" as const,
  }));

  // Add name matches for threads not already represented by a message hit.
  const seenThreads = new Set(rows.map((r) => r.threadId));
  for (const n of nameHits) {
    if (seenThreads.has(n.threadId)) continue;
    seenThreads.add(n.threadId);
    rows.push({
      threadId: n.threadId,
      partnerName: n.user?.fullName ?? "Unknown",
      partnerAvatar: resolveAvatarUrl(n.user),
      snippet: "",
      createdAt: null,
      matchedIn: "name",
    });
  }

  return ok({ data: rows });
}
