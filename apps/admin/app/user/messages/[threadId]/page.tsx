import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
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

  // Verify this user is a participant
  const participant = await prisma.dmThreadParticipant.findUnique({
    where: { threadId_userId: { threadId, userId } },
  });
  if (!participant) notFound();

  // Load initial messages and partner info
  const [messages, allParticipants] = await Promise.all([
    prisma.dmMessage.findMany({
      where: { threadId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      take: 60,
      include: { sender: { select: { id: true, fullName: true } } },
    }),
    prisma.dmThreadParticipant.findMany({
      where: { threadId },
      include: { user: { select: { id: true, fullName: true } } },
    }),
  ]);

  const partner = allParticipants.find((p) => p.userId !== userId)?.user ?? null;

  function serializeMsg(m: (typeof messages)[number]) {
    return {
      ...m,
      createdAt: m.createdAt.toISOString(),
      deletedAt: m.deletedAt?.toISOString() ?? null,
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
