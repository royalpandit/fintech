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
    <div style={{ padding: "28px 24px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a" }}>AI Agents</h1>
        <p style={{ margin: "6px 0 0", fontSize: 14, color: "#64748b" }}>Chat with expert AI agents powered by Gemini — built for finance, investing & more</p>
      </div>

      {agents.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0", color: "#94a3b8" }}>
          <div style={{ fontSize: 52 }}>🤖</div>
          <p style={{ marginTop: 14, fontSize: 15, fontWeight: 600, color: "#64748b" }}>No agents available yet</p>
          <p style={{ fontSize: 13 }}>Check back soon — our team is building expert AI agents for you.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
          {agents.map(a => (
            <Link key={a.id} href={`/user/lab/agents/${a.id}`} style={{ textDecoration: "none" }}>
              <div style={{ background: "#fff", borderRadius: 16, padding: "22px 22px 18px", border: "1.5px solid #e2e8f0", cursor: "pointer", transition: "all 0.15s", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#6366f1"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(99,102,241,0.12)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#e2e8f0"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)"; }}>
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 14 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg,#ede9fe,#c7d2fe)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>
                    {a.avatar}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3, fontWeight: 500 }}>
                      {a.model.replace("gemini-", "Gemini ").replace("-", " ")}
                    </div>
                  </div>
                </div>
                <p style={{ margin: "0 0 14px", fontSize: 13, color: "#475569", lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {a.description}
                </p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>{a._count.sessions.toLocaleString()} conversations</span>
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
