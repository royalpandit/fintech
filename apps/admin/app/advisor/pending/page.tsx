import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import ThemeHeaderButton from "@/components/theme/theme-header-button";

export const dynamic = "force-dynamic";

export default async function AdvisorPendingPage() {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: {
      fullName: true,
      email: true,
      createdAt: true,
      advisorProfile: {
        select: {
          sebiRegistrationNo: true,
          experienceYears: true,
          verificationStatus: true,
          verifiedAt: true,
          rejectionReason: true,
          verifiedBy: { select: { fullName: true } },
        },
      },
    },
  });

  if (!user) redirect("/login");
  const profile = user.advisorProfile;

  if (profile?.verificationStatus === "approved") {
    redirect("/advisor/dashboard");
  }

  const isRejected = profile?.verificationStatus === "rejected";
  const statusLabel = isRejected ? "Rejected" : "Pending Review";

  return (
    <main className="theme-page" style={{ minHeight: "100vh", padding: 24 }}>
      <div style={{ position: "fixed", top: 16, right: 16, zIndex: 50 }}>
        <ThemeHeaderButton />
      </div>
      <section style={{ maxWidth: 720, margin: "0 auto" }}>
        <div className="theme-card-lg" style={{ boxShadow: "0 4px 24px rgba(15, 23, 42, 0.04)" }}>
          <div
            className={isRejected ? "theme-badge-danger" : "theme-badge-warning"}
            style={{ display: "inline-block", marginBottom: 16 }}
          >
            {statusLabel}
          </div>
          <h1 className="theme-heading" style={{ marginBottom: 8, fontSize: 28 }}>
            {profile?.verificationStatus === "rejected"
              ? "Your advisor application was not approved"
              : "Your advisor application is under review"}
          </h1>
          <p className="theme-muted" style={{ margin: "0 0 24px" }}>
            {profile?.verificationStatus === "rejected"
              ? "Our compliance team reviewed your submission and could not approve it at this time."
              : "Our compliance team is verifying your SEBI registration. This typically takes 1–2 business days."}
          </p>

          <div className="theme-panel-muted" style={{ marginBottom: 20 }}>
            <h3 className="theme-heading" style={{ marginBottom: 12, fontSize: 15 }}>
              Submitted Details
            </h3>
            <dl
              style={{
                margin: 0,
                display: "grid",
                gridTemplateColumns: "180px 1fr",
                gap: "8px 16px",
                fontSize: 14,
              }}
            >
              <dt className="theme-muted">Full Name</dt>
              <dd style={{ margin: 0, fontWeight: 500 }}>{user.fullName}</dd>
              <dt className="theme-muted">Email</dt>
              <dd style={{ margin: 0, fontWeight: 500 }}>{user.email}</dd>
              <dt className="theme-muted">SEBI Registration</dt>
              <dd style={{ margin: 0, fontWeight: 500 }}>{profile?.sebiRegistrationNo ?? "—"}</dd>
              <dt className="theme-muted">Experience</dt>
              <dd style={{ margin: 0, fontWeight: 500 }}>
                {profile?.experienceYears ? `${profile.experienceYears} years` : "—"}
              </dd>
              <dt className="theme-muted">Submitted</dt>
              <dd style={{ margin: 0, fontWeight: 500 }}>{user.createdAt.toLocaleDateString()}</dd>
              {profile?.verifiedAt && (
                <>
                  <dt className="theme-muted">Reviewed</dt>
                  <dd style={{ margin: 0, fontWeight: 500 }}>
                    {profile.verifiedAt.toLocaleDateString()}
                    {profile.verifiedBy?.fullName ? ` by ${profile.verifiedBy.fullName}` : ""}
                  </dd>
                </>
              )}
            </dl>
          </div>

          {profile?.verificationStatus === "rejected" && profile?.rejectionReason && (
            <div className="theme-error-box" style={{ marginBottom: 20 }}>
              <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: 13 }}>Reason</p>
              <p style={{ margin: 0, fontSize: 14 }}>{profile.rejectionReason}</p>
            </div>
          )}

          <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
            <Link href="/user/home" className="theme-btn-secondary" style={{ padding: "12px 18px" }}>
              Browse community
            </Link>
            <a
              href="mailto:support@finuer.ai"
              className="theme-btn-primary"
              style={{ padding: "12px 18px" }}
            >
              Contact support
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
