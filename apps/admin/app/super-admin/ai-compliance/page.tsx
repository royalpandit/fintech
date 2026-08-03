import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { scanCompliance, type RiskLevel } from "@/lib/compliance-scan";
import PostModerationActions from "./post-moderation-actions";

export const dynamic = "force-dynamic";

type SearchParams = { risk?: string };

const RISK_TONE: Record<RiskLevel, { bg: string; color: string; label: string }> = {
  high: { bg: "#fee2e2", color: "#b91c1c", label: "High risk" },
  medium: { bg: "#fef3c7", color: "#a16207", label: "Medium risk" },
  low: { bg: "#e0e7ff", color: "#4338ca", label: "Low risk" },
  clear: { bg: "#dcfce7", color: "#15803d", label: "Clear" },
};

const STATUS_TONE: Record<string, { bg: string; color: string }> = {
  approved: { bg: "#dcfce7", color: "#15803d" },
  pending: { bg: "#fef9c3", color: "#a16207" },
  under_review: { bg: "#fef9c3", color: "#a16207" },
  flagged: { bg: "#fee2e2", color: "#b91c1c" },
  rejected: { bg: "#fee2e2", color: "#b91c1c" },
};

const RISK_TABS = [
  { key: "all", label: "All flagged" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
];

export default async function AiCompliancePage({ searchParams }: { searchParams: SearchParams }) {
  const riskFilter = RISK_TABS.some((t) => t.key === searchParams.risk)
    ? (searchParams.risk as string)
    : "all";

  // Scan the most recent posts. Rule-based today; Gemini can augment once connected.
  const posts = await prisma.marketPost.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      title: true,
      content: true,
      disclaimer: true,
      complianceStatus: true,
      marketSymbol: true,
      createdAt: true,
      advisor: { select: { id: true, fullName: true } },
    },
  });

  const scanned = posts.map((p) => ({
    ...p,
    scan: scanCompliance(
      `${p.title} ${p.content}`,
      !!(p.disclaimer && p.disclaimer.trim().length > 0),
    ),
  }));

  const highCount = scanned.filter((s) => s.scan.level === "high").length;
  const mediumCount = scanned.filter((s) => s.scan.level === "medium").length;
  const missingDisclaimer = scanned.filter((s) => s.scan.flags.includes("Missing risk disclaimer")).length;

  // Only surface posts that tripped at least one rule; sort riskiest first.
  let flagged = scanned
    .filter((s) => s.scan.level !== "clear")
    .sort((a, b) => b.scan.score - a.scan.score);
  if (riskFilter !== "all") flagged = flagged.filter((s) => s.scan.level === riskFilter);

  const stats = [
    { label: "High risk", value: highCount, tone: highCount > 0 ? "#dc2626" : "#16a34a" },
    { label: "Medium risk", value: mediumCount, tone: "var(--text)" },
    { label: "Missing disclaimer", value: missingDisclaimer, tone: "var(--text)" },
    { label: "Posts scanned", value: scanned.length, tone: "var(--accent-blue, #2563eb)" },
  ];

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 22 }}>🛡️</span>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>
            AI Compliance
          </h1>
          <p className="page-subtitle" style={{ margin: "2px 0 0" }}>
            Automated SEBI-norms scan of advisor posts — flags assured-return language, hype, and
            missing disclaimers for review.
          </p>
        </div>
      </div>

      <div
        style={{
          margin: "16px 0",
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px dashed var(--border)",
          background: "var(--surface-2)",
          fontSize: 12,
          color: "var(--text-muted)",
        }}
      >
        <strong style={{ color: "var(--text)" }}>Rule-based engine active.</strong> Connect{" "}
        <Link href="/super-admin/settings" style={{ color: "var(--accent-blue, #2563eb)", fontWeight: 600 }}>
          Google Gemini
        </Link>{" "}
        in Settings to add an LLM review pass on top of these signals.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 16 }}>
        {stats.map((s) => (
          <article key={s.label} className="stat-card">
            <p className="stat-card-label">{s.label}</p>
            <p className="stat-card-value" style={{ color: s.tone }}>
              {s.value}
            </p>
          </article>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {RISK_TABS.map((t) => {
          const active = t.key === riskFilter;
          return (
            <Link
              key={t.key}
              href={`/super-admin/ai-compliance?risk=${t.key}`}
              style={{
                padding: "8px 16px",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
                border: "1px solid var(--border)",
                background: active ? "var(--primary-soft)" : "var(--surface)",
                color: active ? "#047857" : "var(--text-muted)",
              }}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <article className="card" style={{ padding: 0, overflow: "hidden" }}>
        {flagged.length === 0 ? (
          <p style={{ textAlign: "center", padding: 48, color: "var(--text-muted)", margin: 0 }}>
            No {riskFilter === "all" ? "" : riskFilter + "-risk "}posts flagged by the scanner. 🎉
          </p>
        ) : (
          <div className="table-wrap">
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: "var(--text-muted)" }}>
                  {["Risk", "Post", "Advisor", "Findings", "Status", ""].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: h === "" ? "right" : "left",
                        padding: "12px 16px",
                        fontWeight: 600,
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: 0.6,
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {flagged.map((p) => {
                  const tone = RISK_TONE[p.scan.level];
                  const statusTone = STATUS_TONE[p.complianceStatus] ?? {
                    bg: "var(--surface-2)",
                    color: "var(--text-muted)",
                  };
                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "3px 9px",
                            borderRadius: 999,
                            background: tone.bg,
                            color: tone.color,
                          }}
                        >
                          {tone.label} · {p.scan.score}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", maxWidth: 260 }}>
                        <Link
                          href={`/super-admin/market-posts/${p.id}`}
                          style={{ fontWeight: 600, color: "var(--text)", textDecoration: "none" }}
                        >
                          {p.title}
                        </Link>
                        {p.marketSymbol && (
                          <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>
                            {p.marketSymbol}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        {p.advisor?.fullName ?? "—"}
                      </td>
                      <td style={{ padding: "12px 16px", maxWidth: 320 }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {p.scan.flags.map((f) => (
                            <span
                              key={f}
                              style={{
                                fontSize: 11,
                                padding: "2px 8px",
                                borderRadius: 6,
                                background: "var(--surface-2)",
                                color: "var(--text-muted)",
                              }}
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 10,
                            background: statusTone.bg,
                            color: statusTone.color,
                            textTransform: "capitalize",
                          }}
                        >
                          {p.complianceStatus.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <PostModerationActions id={p.id} status={p.complianceStatus} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}
