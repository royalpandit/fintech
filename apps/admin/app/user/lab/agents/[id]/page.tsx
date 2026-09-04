import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import { userAvatarSelect, resolveAvatarUrl } from "@/lib/user-avatar";
import AgentChat from "@/components/agents/agent-chat";

export const dynamic = "force-dynamic";

export default async function AgentChatPage({ params }: { params: { id: string } }) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);

  const [agent, user] = await Promise.all([
    prisma.geminiAgent.findUnique({
      where: { id: Number(params.id), isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        avatar: true,
        model: true,
        starterPrompts: true,
      },
    }),
    auth
      ? prisma.user.findUnique({
          where: { id: auth.userId },
          select: { fullName: true, ...userAvatarSelect },
        })
      : null,
  ]);
  if (!agent) notFound();

  return (
    <AgentChat
      agent={agent}
      userName={user?.fullName ?? null}
      userAvatar={resolveAvatarUrl(user)}
    />
  );
}
