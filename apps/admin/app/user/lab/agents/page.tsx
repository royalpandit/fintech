import { prisma } from "@/lib/prisma";
import AgentsBrowser from "@/components/agents-browser";

export const dynamic = "force-dynamic";

export default async function AgentsBrowserPage() {
  const agents = await prisma.geminiAgent.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, description: true, avatar: true, model: true, _count: { select: { sessions: true } } },
  });

  return (
    <div style={{ width: "100%", minWidth: 0 }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "var(--text)" }}>Financial AI Agents</h1>
        <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--text-muted)" }}>
          Chat with our Gemini-powered financial agents — built for finance, investing &amp; markets
        </p>
      </div>

      {agents.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 52 }}>🤖</div>
          <p style={{ marginTop: 14, fontSize: 15, fontWeight: 600, color: "var(--text-muted)" }}>No agents available yet</p>
          <p style={{ fontSize: 13 }}>Check back soon — our team is building expert AI agents for you.</p>
        </div>
      ) : (
        <AgentsBrowser agents={agents} />
      )}
    </div>
  );
}
