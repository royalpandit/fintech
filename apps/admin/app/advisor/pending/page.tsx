import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";

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
  const statusColor = isRejected ? "#dc2626" : "#d97706";
  const statusBg = isRejected ? "#fef2f2" : "#fffbeb";
  const statusLabel = isRejected ? "Rejected" : "Pending Review";

  return (
    <section style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 32, boxShadow: "0 4px 24px rgba(15, 23, 42, 0.04)" }}>
        <div style={{ display: "inline-block", padding: "6px 12px", borderRadius: 999, background: statusBg, color: statusColor, fontWeight: 600, fontSize: 13, marginBottom: 16 }}>
          {statusLabel}
        </div>
        <h1 style={{ margin: 0, marginBottom: 8, fontSize: 28 }}>
          {profile?.verificationStatus === "rejected"
            ? "Your advisor application was not approved"
            : "Your advisor application is under review"}
        </h1>
        <p style={{ margin: 0, marginBottom: 24, color: "#61708b" }}>
          {profile?.verificationStatus === "rejected"
            ? "Our compliance team reviewed your submission and could not approve it at this time."
            : "Our compliance team is verifying your SEBI registration. This typically takes 1–2 business days."}
        </p>

        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 14, padding: 20, marginBottom: 20 }}>
          <h3 style={{ margin: 0, marginBottom: 12, fontSize: 15 }}>Submitted Details</h3>
          <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "180px 1fr", gap: "8px 16px", fontSize: 14 }}>
            <dt style={{ color: "#61708b" }}>Full Name</dt>
            <dd style={{ margin: 0, fontWeight: 500 }}>{user.fullName}</dd>
            <dt style={{ color: "#61708b" }}>Email</dt>
            <dd style={{ margin: 0, fontWeight: 500 }}>{user.email}</dd>
            <dt style={{ color: "#61708b" }}>SEBI Registration</dt>
            <dd style={{ margin: 0, fontWeight: 500 }}>{profile?.sebiRegistrationNo ?? "—"}</dd>
            <dt style={{ color: "#61708b" }}>Experience</dt>
            <dd style={{ margin: 0, fontWeight: 500 }}>
              {profile?.experienceYears ? `${profile.experienceYears} years` : "—"}
            </dd>
            <dt style={{ color: "#61708b" }}>Submitted</dt>
            <dd style={{ margin: 0, fontWeight: 500 }}>
              {user.createdAt.toLocaleDateString()}
            </dd>
            {profile?.verifiedAt && (
              <>
                <dt style={{ color: "#61708b" }}>Reviewed</dt>
                <dd style={{ margin: 0, fontWeight: 500 }}>
                  {profile.verifiedAt.toLocaleDateString()}
                  {profile.verifiedBy?.fullName
                    ? ` by ${profile.verifiedBy.fullName}`
                    : ""}
                </dd>
              </>
            )}
          </dl>
        </div>

        {profile?.verificationStatus === "rejected" && profile?.rejectionReason && (
          <div style={{ padding: 16, borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", marginBottom: 20 }}>
            <p style={{ margin: 0, marginBottom: 4, fontWeight: 600, fontSize: 13, color: "#991b1b" }}>
              Reason
            </p>
            <p style={{ margin: 0, fontSize: 14, color: "#7f1d1d" }}>
              {profile.rejectionReason}
            </p>
          </div>
        )}

        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <Link
            href="/user/home"
            style={{ padding: "12px 18px", borderRadius: 10, border: "1px solid #d1d9e6", background: "#fff", fontSize: 14, fontWeight: 600, color: "#0f172a", textDecoration: "none" }}
          >
            Browse community
          </Link>
          <a
            href="mailto:support@corescent.ai"
            style={{ padding: "12px 18px", borderRadius: 10, background: "#2563eb", color: "#fff", fontSize: 14, fontWeight: 600, textDecoration: "none" }}
          >
            Contact support
          </a>
        </div>
      </div>
    </section>
  );
}
