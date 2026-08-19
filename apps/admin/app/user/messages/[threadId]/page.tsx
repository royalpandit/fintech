import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import { userAvatarSelect, resolveAvatarUrl } from "@/lib/user-avatar";
import ChatClient from "./ChatClient";

export const dynamic = "force-dynamic";

export default async function ChatPage({
  params,
}: {
  params: { threadId: string };
}) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth) redirect("/login");

  const userId = auth.userId;
  const threadId = Number(params.threadId);

  if (!Number.isFinite(threadId)) notFound();

  // Participants double as the access check — if the viewer isn't in the list
  // the thread 404s. Fetching them alongside the messages (rather than gating
  // on a separate round trip first) halves the time to first paint.
  const [messages, allParticipants] = await Promise.all([
    prisma.dmMessage.findMany({
      where: { threadId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 60,
      include: { sender: { select: { id: true, fullName: true, ...userAvatarSelect } } },
    }),
    prisma.dmThreadParticipant.findMany({
      where: { threadId },
      include: { user: { select: { id: true, fullName: true, ...userAvatarSelect } } },
    }),
  ]);

  if (!allParticipants.some((p) => p.userId === userId)) notFound();

  // Query pulls newest-first (so `take: 60` keeps the most recent page, not the
  // oldest); the UI renders oldest-first.
  messages.reverse();

  const partnerRow = allParticipants.find((p) => p.userId !== userId)?.user ?? null;
  const partner = partnerRow
    ? {
        id: partnerRow.id,
        fullName: partnerRow.fullName,
        avatarUrl: resolveAvatarUrl(partnerRow),
      }
    : null;

  function serializeMsg(m: (typeof messages)[number]) {
    return {
      ...m,
      createdAt: m.createdAt.toISOString(),
      deletedAt: m.deletedAt?.toISOString() ?? null,
      sender: {
        id: m.sender.id,
        fullName: m.sender.fullName,
        avatarUrl: resolveAvatarUrl(m.sender),
      },
    };
  }

  return (
    <ChatClient
      threadId={threadId}
      userId={userId}
      partner={partner}
      initialMessages={messages.map(serializeMsg)}
    />
  );
}
