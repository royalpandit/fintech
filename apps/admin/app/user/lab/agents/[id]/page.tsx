import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AgentChat from "@/components/agents/agent-chat";

export const dynamic = "force-dynamic";

export default async function AgentChatPage({ params }: { params: { id: string } }) {
  const agent = await prisma.geminiAgent.findUnique({
    where: { id: Number(params.id), isActive: true },
    select: { id: true, name: true, description: true, avatar: true, model: true },
  });
  if (!agent) notFound();

  return <AgentChat agent={agent} />;
}
