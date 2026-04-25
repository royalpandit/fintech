import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = { status?: string };

function relTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

function statusPill(status: string) {
  const map: Record<string, { bg: string; fg: string }> = {
    approved: { bg: "#d1fae5", fg: "#047857" },
    pending: { bg: "#fef3c7", fg: "#92400e" },
    rejected: { bg: "#fee2e2", fg: "#991b1b" },
  };
  const s = map[status] ?? map.pending;
  return (
    <span
      style={{
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        background: s.bg,
        color: s.fg,
        textTransform: "capitalize",
      }}
    >
      {status}
    </span>
  );
}

export default async function AdminAdvisorsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const status = searchParams.status ?? "pending";

  const where: Record<string, unknown> = {};
  if (["pending", "approved", "rejected"].includes(status)) {
    where.verificationStatus = status;
  }

  const [advisors, pendingCount, approvedCount, rejectedCount] = await Promise.all([
    prisma.advisorProfile.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true } },
        verifiedBy: { select: { fullName: true } },
      },
    }),
    prisma.advisorProfile.count({ where: { verificationStatus: "pending" } }),
    prisma.advisorProfile.count({ where: { verificationStatus: "approved" } }),
    prisma.advisorProfile.count({ where: { verificationStatus: "rejected" } }),
  ]);

  const tabs = [
    { key: "pending", label: `Pending (${pendingCount})`, color: "#f59e0b" },
    { key: "approved", label: `Approved (${approvedCount})`, color: "#10b981" },
    { key: "rejected", label: `Rejected (${rejectedCount})`, color: "#ef4444" },
  ];

  return (
    <section className="advisor-scope" style={{ ["--advisor-primary" as any]: "#2563eb" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 18,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 800,
              color: "#0f172a",
              letterSpacing: -0.6,
            }}
          >
            Verification Queue
          </h1>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
            Review and act on advisor SEBI verifications
          </p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 14,
          marginBottom: 18,
        }}
      >
        {tabs.map((t) => {
          const value =
            t.key === "pending" ? pendingCount : t.key === "approved" ? approvedCount : rejectedCount;
          return (
            <Link
              key={t.key}
              href={`/admin/advisors?status=${t.key}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <article
                className="stat-card"
                style={{
                  cursor: "pointer",
                  borderColor: status === t.key ? t.color : "#eef0f4",
                }}
              >
                <p className="stat-card-label">{t.label.split(" (")[0]}</p>
                <p className="stat-card-value" style={{ color: t.color }}>
                  {value.toLocaleString()}
                </p>
                <span
                  className="stat-card-delta"
                  style={{ color: status === t.key ? t.color : "#94a3b8" }}
                >
                  {status === t.key ? "● Active filter" : "Click to filter"}
                </span>
              </article>
            </Link>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/admin/advisors?status=${t.key}`}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: status === t.key ? "#fff" : "#64748b",
              background: status === t.key ? "#2563eb" : "#fff",
              border: "1px solid #eef0f4",
              textDecoration: "none",
            }}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <article className="widget" style={{ padding: 0, overflow: "hidden" }}>
        {advisors.length === 0 ? (
          <p
            style={{
              margin: 0,
              padding: 48,
              textAlign: "center",
              color: "#94a3b8",
              fontSize: 13,
            }}
          >
            No advisors in this bucket.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Advisor", "SEBI ID", "Experience", "Submitted", "Status", "Reviewed By", ""].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: h === "" ? "right" : "left",
                          padding: "12px 18px",
                          fontWeight: 600,
                          fontSize: 11,
                          color: "#64748b",
                          textTransform: "uppercase",
                          letterSpacing: 0.6,
                          borderBottom: "1px solid #eef0f4",
                        }}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {advisors.map((adv) => {
                  const initials = (adv.user?.fullName ?? "??")
                    .split(" ")
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();
                  return (
                    <tr key={adv.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "14px 18px" }}>
                        <Link
                          href={`/admin/advisors/${adv.user?.id}`}
                          style={{
                            display: "flex",
                            gap: 10,
                            alignItems: "center",
                            color: "#0f172a",
                            textDecoration: "none",
                          }}
                        >
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 9,
                              background: "linear-gradient(135deg, rgba(37,99,235,0.13), rgba(99,102,241,0.13))",
                              color: "#2563eb",
                              display: "grid",
                              placeItems: "center",
                              fontSize: 11,
                              fontWeight: 800,
                              flexShrink: 0,
                            }}
                          >
                            {initials}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>
                              {adv.user?.fullName ?? "Advisor"}
                            </div>
                            <div style={{ fontSize: 11, color: "#64748b" }}>{adv.user?.email}</div>
                          </div>
                        </Link>
                      </td>
                      <td
                        style={{
                          padding: "14px 18px",
                          fontFamily: "monospace",
                          fontSize: 11,
                          color: "#475569",
                        }}
                      >
                        {adv.sebiRegistrationNo}
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        {adv.experienceYears ? `${adv.experienceYears}y` : "—"}
                      </td>
                      <td style={{ padding: "14px 18px", color: "#64748b", fontSize: 12 }}>
                        {relTime(adv.createdAt)}
                      </td>
                      <td style={{ padding: "14px 18px" }}>{statusPill(adv.verificationStatus)}</td>
                      <td style={{ padding: "14px 18px", color: "#64748b", fontSize: 12 }}>
                        {adv.verifiedBy?.fullName ?? "—"}
                      </td>
                      <td style={{ padding: "14px 18px", textAlign: "right" }}>
                        <Link
                          href={`/admin/advisors/${adv.user?.id}`}
                          style={{
                            padding: "6px 14px",
                            borderRadius: 8,
                            background: "#2563eb",
                            color: "#fff",
                            fontSize: 12,
                            fontWeight: 700,
                            textDecoration: "none",
                          }}
                        >
                          {status === "pending" ? "Review" : "Open"}
                        </Link>
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
