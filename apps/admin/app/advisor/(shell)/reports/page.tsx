import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { FiFileText, FiDownload } from "react-icons/fi";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import ReportComposer from "./report-composer";
import DeleteReportButton from "./delete-report-button";

export const dynamic = "force-dynamic";

function formatINR(n: number | null | undefined) {
  if (!n) return "Free";
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

function formatSize(bytes: number | null | undefined) {
  if (!bytes) return "";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default async function AdvisorReportsPage() {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth) redirect("/login");

  const reports = await prisma.advisorReport.findMany({
    where: { advisorUserId: auth.userId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  const paidCount = reports.filter((r) => r.accessType === "paid").length;

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12 }}>
        <div>
          <h1 className="page-title">My Reports</h1>
          <p className="page-subtitle">
            Upload research reports (PDF) for your audience — free or paid.
          </p>
        </div>
        <ReportComposer />
      </div>

      <div className="grid grid-4" style={{ marginTop: 16 }}>
        <article className="card">
          <p className="metric-label">Total Reports</p>
          <p className="metric-value" style={{ fontSize: 34 }}>
            {reports.length}
          </p>
        </article>
        <article className="card">
          <p className="metric-label">Free</p>
          <p className="metric-value" style={{ fontSize: 34 }}>
            {reports.length - paidCount}
          </p>
        </article>
        <article className="card">
          <p className="metric-label">Paid</p>
          <p className="metric-value" style={{ fontSize: 34 }}>
            {paidCount}
          </p>
        </article>
      </div>

      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16, marginTop: 16 }}
      >
        {reports.length === 0 ? (
          <article className="card" style={{ gridColumn: "1 / -1", textAlign: "center", padding: 48 }}>
            <p className="page-subtitle" style={{ margin: 0 }}>
              You haven't uploaded any reports yet. Click <strong>+ New Report</strong> to add one.
            </p>
          </article>
        ) : (
          reports.map((report) => (
            <article key={report.id} className="card" style={{ height: "100%" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: "rgba(14,165,233,0.12)",
                    color: "#2563eb",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <FiFileText size={20} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: 16, lineHeight: 1.4 }}>{report.title}</h3>
                  <span
                    style={{
                      display: "inline-block",
                      marginTop: 4,
                      padding: "2px 10px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                      background: report.accessType === "paid" ? "#fef3c7" : "#d1fae5",
                      color: report.accessType === "paid" ? "#92400e" : "#047857",
                    }}
                  >
                    {report.accessType === "paid" ? formatINR(Number(report.price)) : "Free"}
                  </span>
                </div>
              </div>

              {report.description && (
                <p
                  style={{
                    margin: "12px 0 0",
                    fontSize: 13,
                    color: "var(--text-muted)",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {report.description}
                </p>
              )}

              <div
                style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: "1px solid var(--border)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: 12,
                  color: "var(--text-muted)",
                }}
              >
                <a
                  href={report.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    color: "#2563eb",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  <FiDownload size={13} /> View PDF
                  {report.fileSize ? ` · ${formatSize(report.fileSize)}` : ""}
                </a>
                <DeleteReportButton id={report.id} />
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
