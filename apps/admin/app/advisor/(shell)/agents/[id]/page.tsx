import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import { userAvatarSelect, resolveAvatarUrl } from "@/lib/user-avatar";
import AgentChat from "@/components/agents/agent-chat";

export const dynamic = "force-dynamic";

export default async function AdvisorAgentChatPage({ params }: { params: { id: string } }) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth || auth.role !== "advisor") redirect("/login");

  const [agent, user] = await Promise.all([
    prisma.geminiAgent.findUnique({
      where: { id: Number(params.id), isActive: true },
      select: { id: true, name: true, description: true, avatar: true, model: true },
    }),
    prisma.user.findUnique({
      where: { id: auth.userId },
      select: { fullName: true, ...userAvatarSelect },
    }),
  ]);
  if (!agent) notFound();

  return (
    <AgentChat
      agent={agent}
      userName={user?.fullName ?? null}
      userAvatar={resolveAvatarUrl(user)}
      backHref="/advisor/agents"
    />
  );
}
