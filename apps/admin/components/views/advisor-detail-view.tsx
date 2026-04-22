import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AdvisorActions from "@/components/views/advisor-actions";

function statusTag(status: string) {
  if (status === "approved") return <span className="tag success">Verified</span>;
  if (status === "rejected") return <span className="tag danger">Rejected</span>;
  return <span className="tag">Pending</span>;
}

function scoreColor(score: number) {
  if (score >= 85) return "#10b981";
  if (score >= 65) return "#f59e0b";
  return "#ef4444";
}

export default async function AdvisorDetailView({
  advisorUserId,
  backHref,
}: {
  advisorUserId: number;
  backHref: string;
}) {
  if (!Number.isFinite(advisorUserId) || advisorUserId <= 0) notFound();

  const advisor = await prisma.user.findFirst({
    where: { id: advisorUserId, role: "advisor" },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
      advisorProfile: {
        select: {
          sebiRegistrationNo: true,
          experienceYears: true,
          bio: true,
          expertiseTags: true,
          verificationStatus: true,
          verifiedAt: true,
          rejectionReason: true,
          verifiedBy: { select: { fullName: true } },
        },
      },
      kycDocuments: {
        select: { id: true, documentType: true, verificationStatus: true, verifiedAt: true },
      },
    },
  });

  if (!advisor || !advisor.advisorProfile) notFound();

  const [postStats, subscriberCount, latestMetrics] = await Promise.all([
    prisma.marketPost.groupBy({
      by: ["complianceStatus"],
      where: { advisorUserId },
      _count: { _all: true },
    }),
    prisma.subscription.count({ where: { advisorUserId, status: "active" } }),
    prisma.advisorMetricDaily.findFirst({
      where: { advisorUserId },
      orderBy: { day: "desc" },
    }),
  ]);

  const profile = advisor.advisorProfile;
  const totalPosts = postStats.reduce((sum, row) => sum + row._count._all, 0);
  const approvedPosts = postStats.find((r) => r.complianceStatus === "approved")?._count._all ?? 0;
  const accuracy = latestMetrics?.accuracyPct ? Number(latestMetrics.accuracyPct) : 0;
  const qualityScore = Math.min(
    100,
    Math.round(accuracy || (totalPosts ? (approvedPosts / totalPosts) * 100 : 0)),
  );

  return (
    <section>
      <Link href={backHref} className="page-subtitle" style={{ display: "inline-block", marginTop: 0 }}>
        ← Advisors / {advisor.fullName}
      </Link>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 16,
          alignItems: "end",
          marginTop: 8,
        }}
      >
        <div>
          <h1 className="page-title" style={{ marginBottom: 8 }}>
            {advisor.fullName}
          </h1>
          <p className="page-subtitle">
            {profile.bio || `SEBI-registered advisor (${profile.sebiRegistrationNo}).`}
          </p>
        </div>
        <AdvisorActions
          advisorUserId={advisor.id}
          currentStatus={profile.verificationStatus}
        />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.35fr 1fr", marginTop: 16 }}>
        <article className="card">
          <h3 style={{ marginTop: 0 }}>Profile Information</h3>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <p className="metric-label">Full Legal Name</p>
              <input className="input" value={advisor.fullName} readOnly />
            </div>
            <div>
              <p className="metric-label">SEBI ID</p>
              <input className="input" value={profile.sebiRegistrationNo} readOnly />
            </div>
            <div>
              <p className="metric-label">Email</p>
              <input className="input" value={advisor.email} readOnly />
            </div>
            <div>
              <p className="metric-label">Phone</p>
              <input className="input" value={advisor.phone} readOnly />
            </div>
            <div>
              <p className="metric-label">Experience</p>
              <input
                className="input"
                value={profile.experienceYears ? `${profile.experienceYears} years` : "—"}
                readOnly
              />
            </div>
            <div>
              <p className="metric-label">Joined</p>
              <input className="input" value={advisor.createdAt.toLocaleDateString()} readOnly />
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <p className="metric-label">Verification Status</p>
            {statusTag(profile.verificationStatus)}
            {profile.verifiedAt && (
              <span style={{ marginLeft: 10, fontSize: 13, color: "#61708b" }}>
                {profile.verificationStatus === "approved" ? "Approved" : "Reviewed"}{" "}
                {profile.verifiedAt.toLocaleDateString()}
                {profile.verifiedBy?.fullName ? ` by ${profile.verifiedBy.fullName}` : ""}
              </span>
            )}
          </div>

          {profile.verificationStatus === "rejected" && profile.rejectionReason && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 10,
                background: "#fef2f2",
                border: "1px solid #fecaca",
              }}
            >
              <p style={{ margin: 0, marginBottom: 4, fontWeight: 600, fontSize: 13, color: "#991b1b" }}>
                Rejection reason
              </p>
              <p style={{ margin: 0, fontSize: 13, color: "#7f1d1d" }}>{profile.rejectionReason}</p>
            </div>
          )}
        </article>

        <article className="card">
          <h3 style={{ marginTop: 0 }}>Performance Metrics</h3>
          <p className="metric-label">Quality Score</p>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 180, height: 8, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}>
              <div
                style={{
                  width: `${qualityScore}%`,
                  height: "100%",
                  background: scoreColor(qualityScore),
                }}
              />
            </div>
            <strong>{qualityScore}%</strong>
          </div>

          <div style={{ marginTop: 16 }}>
            <p className="metric-label">Active Subscribers</p>
            <p className="metric-value" style={{ fontSize: 28 }}>
              {subscriberCount.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="metric-label">Published Posts</p>
            <p style={{ marginTop: 4, fontWeight: 600 }}>
              {approvedPosts} of {totalPosts} approved
            </p>
          </div>
          {latestMetrics?.earningsAmount && (
            <div style={{ marginTop: 12 }}>
              <p className="metric-label">Latest Earnings (daily)</p>
              <p style={{ marginTop: 4, fontWeight: 600 }}>
                ₹{Number(latestMetrics.earningsAmount).toLocaleString()}
              </p>
            </div>
          )}
        </article>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.35fr 1fr", marginTop: 16 }}>
        <article className="card">
          <h3 style={{ marginTop: 0 }}>KYC Documentation</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Status</th>
                  <th>Verified</th>
                </tr>
              </thead>
              <tbody>
                {advisor.kycDocuments.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ color: "#61708b" }}>
                      No KYC documents uploaded yet.
                    </td>
                  </tr>
                ) : (
                  advisor.kycDocuments.map((doc) => (
                    <tr key={doc.id}>
                      <td style={{ textTransform: "uppercase" }}>{doc.documentType}</td>
                      <td>{statusTag(doc.verificationStatus)}</td>
                      <td>{doc.verifiedAt ? doc.verifiedAt.toLocaleDateString() : "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="card">
          <h3 style={{ marginTop: 0 }}>Expertise & Activity</h3>
          <p className="metric-label">Expertise Tags</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {profile.expertiseTags.length === 0 ? (
              <span style={{ fontSize: 13, color: "#61708b" }}>None specified</span>
            ) : (
              profile.expertiseTags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))
            )}
          </div>
          <p className="metric-label">Last Login</p>
          <p style={{ marginTop: 4, fontWeight: 600 }}>
            {advisor.lastLoginAt ? advisor.lastLoginAt.toLocaleString() : "Never"}
          </p>
        </article>
      </div>
    </section>
  );
}
