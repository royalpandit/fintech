import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AgentsBrowserPage() {
  const agents = await prisma.geminiAgent.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, description: true, avatar: true, model: true, _count: { select: { sessions: true } } },
  });

  return (
    <div style={{ width: "100%", minWidth: 0 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "var(--text)" }}>AI Agents</h1>
        <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--text-muted)" }}>Chat with expert AI agents powered by Gemini — built for finance, investing & more</p>
      </div>

      {agents.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 52 }}>🤖</div>
          <p style={{ marginTop: 14, fontSize: 15, fontWeight: 600, color: "var(--text-muted)" }}>No agents available yet</p>
          <p style={{ fontSize: 13 }}>Check back soon — our team is building expert AI agents for you.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
          {agents.map(a => (
            <Link key={a.id} href={`/user/lab/agents/${a.id}`} style={{ textDecoration: "none" }}>
              <div style={{ background: "var(--surface)", borderRadius: 16, padding: "22px 22px 18px", border: "1.5px solid var(--border)", cursor: "pointer", transition: "all 0.15s", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#6366f1"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(99,102,241,0.12)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)"; }}>
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 14 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg,#ede9fe,#c7d2fe)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>
                    {a.avatar}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text)" }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3, fontWeight: 500 }}>
                      {a.model.replace("gemini-", "Gemini ").replace("-", " ")}
                    </div>
                  </div>
                </div>
                <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--text)", lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {a.description}
                </p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{a._count.sessions.toLocaleString()} conversations</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#6366f1", display: "flex", alignItems: "center", gap: 4 }}>
                    Chat <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
