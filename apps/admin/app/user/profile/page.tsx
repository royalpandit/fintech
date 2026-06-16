import Link from "next/link";
import { cookies } from "next/headers";
import { FiUser } from "react-icons/fi";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import { CheckCircle } from "@/components/advisor-ui/icons";

export const dynamic = "force-dynamic";

const KYC_DOCS = [
  { type: "pan", label: "PAN Card" },
  { type: "aadhaar", label: "Aadhaar" },
];

export default async function UserProfilePage() {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);

  if (!auth) {
    return (
      <section>
        <article
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: 48,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12, color: "var(--text-muted)", display: "flex", justifyContent: "center" }}>
            <FiUser size={36} />
          </div>
          <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800 }}>
            Sign in to view your profile
          </h2>
          <Link
            href="/register"
            style={{
              display: "inline-block",
              marginTop: 12,
              padding: "10px 22px",
              borderRadius: 10,
              background: "linear-gradient(135deg, #0ea5e9, #16a34a)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            Get started — free
          </Link>
        </article>
      </section>
    );
  }

  const userId = auth.userId;

  const [
    user,
    kycDocs,
    portfolio,
    activeSubscriptions,
    courseEnrollments,
    followingCount,
    financialScore,
    riskProfile,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        fullName: true,
        email: true,
        phone: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
      },
    }),
    prisma.kycDocument.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.portfolio.findFirst({
      where: { userId, deletedAt: null },
    }),
    prisma.subscription.count({ where: { userId, status: "active" } }),
    prisma.courseEnrollment.count({ where: { userId } }),
    prisma.userFollow.count({ where: { followerUserId: userId } }),
    prisma.financialScore.findFirst({
      where: { userId },
      orderBy: { calculationDate: "desc" },
    }),
    prisma.riskProfile.findUnique({ where: { userId } }),
  ]);

  if (!user) {
    return null;
  }

  const initials = user.fullName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const kycByType = new Map(kycDocs.map((d) => [d.documentType, d]));
  const kycComplete = KYC_DOCS.every(
    (d) => kycByType.get(d.type as any)?.verificationStatus === "approved",
  );

  return (
    <section>
      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 800,
            color: "var(--text)",
            letterSpacing: -0.5,
          }}
        >
          Profile
        </h1>
        <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 12 }}>
          Account information, KYC verification, and risk profile
        </p>
      </div>

      {/* Profile hero */}
      <article
        style={{
          background: "linear-gradient(135deg, #0c4a6e, #0ea5e9)",
          color: "#fff",
          borderRadius: 18,
          padding: 24,
          marginBottom: 16,
          display: "flex",
          gap: 16,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 18,
            background: "linear-gradient(135deg, #0ea5e9, #10b981)",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontSize: 24,
            fontWeight: 800,
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: -0.5,
            }}
          >
            {user.fullName}
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(255,255,255,0.78)" }}>
            {user.email} · {user.phone}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
            Member since {user.createdAt.toLocaleDateString()}
          </p>
        </div>
        {kycComplete && (
          <span
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              background: "rgba(167, 243, 208, 0.18)",
              color: "#a7f3d0",
              fontSize: 11,
              fontWeight: 800,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <CheckCircle size={12} />
            KYC VERIFIED
          </span>
        )}
      </article>

      {/* Stats strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 18,
        }}
      >
        {[
          {
            label: "Following",
            value: followingCount.toLocaleString(),
            color: "#0ea5e9",
          },
          {
            label: "Subscriptions",
            value: activeSubscriptions.toLocaleString(),
            color: "#10b981",
          },
          {
            label: "Courses",
            value: courseEnrollments.toLocaleString(),
            color: "#7c3aed",
          },
          {
            label: "Health Score",
            value: financialScore?.score?.toString() ?? "—",
            color: "#f59e0b",
          },
        ].map((s) => (
          <article
            key={s.label}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 16,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 11,
                color: "var(--text-muted)",
                fontWeight: 500,
                marginBottom: 6,
              }}
            >
              {s.label}
            </p>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: s.color, letterSpacing: -0.5 }}>
              {s.value}
            </p>
          </article>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14 }}>
        {/* Account info */}
        <article
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: 18,
          }}
        >
          <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
            Account Information
          </h3>
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  color: "var(--text-muted)",
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                Full Name
              </p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{user.fullName}</p>
            </div>
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  color: "var(--text-muted)",
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                Email
              </p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
                {user.email}
                {user.emailVerifiedAt && (
                  <span
                    style={{
                      marginLeft: 6,
                      padding: "1px 6px",
                      borderRadius: 999,
                      background: "#d1fae5",
                      color: "#047857",
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    VERIFIED
                  </span>
                )}
              </p>
            </div>
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  color: "var(--text-muted)",
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                Phone
              </p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, fontFamily: "monospace" }}>
                {user.phone}
              </p>
            </div>
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  color: "var(--text-muted)",
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                Last Login
              </p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
                {user.lastLoginAt ? user.lastLoginAt.toLocaleString() : "—"}
              </p>
            </div>
          </div>

          <div style={{ marginTop: 18, display: "flex", gap: 8 }}>
            <Link
              href="/user/settings"
              style={{
                padding: "10px 18px",
                borderRadius: 10,
                background: "var(--surface-2)",
                color: "var(--text)",
                fontWeight: 700,
                fontSize: 12,
                textDecoration: "none",
                border: "1px solid var(--border)",
              }}
            >
              Edit Profile
            </Link>
          </div>
        </article>

        {/* KYC + risk */}
        <div style={{ display: "grid", gap: 14 }}>
          <article
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 18,
            }}
          >
            <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
              KYC Verification
            </h3>
            <div style={{ display: "grid", gap: 8 }}>
              {KYC_DOCS.map((doc) => {
                const docData = kycByType.get(doc.type as any);
                const status = docData?.verificationStatus ?? "missing";
                const tone =
                  status === "approved"
                    ? { bg: "#d1fae5", fg: "#047857", icon: "✓" }
                    : status === "pending"
                      ? { bg: "#fef3c7", fg: "#92400e", icon: "⋯" }
                      : status === "rejected"
                        ? { bg: "#fee2e2", fg: "#991b1b", icon: "✗" }
                        : { bg: "#f1f5f9", fg: "#475569", icon: "○" };
                return (
                  <div
                    key={doc.type}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: "var(--surface-2)",
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                      {doc.label}
                    </span>
                    <span
                      style={{
                        padding: "2px 10px",
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 700,
                        background: tone.bg,
                        color: tone.fg,
                        textTransform: "uppercase",
                      }}
                    >
                      {tone.icon}{" "}
                      {status === "missing" ? "Not uploaded" : status}
                    </span>
                  </div>
                );
              })}
            </div>

            <Link
              href="/user/settings#kyc"
              style={{
                display: "block",
                textAlign: "center",
                padding: "10px 14px",
                borderRadius: 10,
                background: kycComplete ? "var(--surface-2)" : "linear-gradient(135deg, #0ea5e9, #10b981)",
                color: kycComplete ? "var(--text)" : "#fff",
                fontWeight: 700,
                fontSize: 12,
                textDecoration: "none",
                marginTop: 12,
                border: kycComplete ? "1px solid var(--border)" : "none",
              }}
            >
              {kycComplete ? "View documents" : "Complete KYC"}
            </Link>
          </article>

          <article
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 18,
            }}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
              Risk Profile
            </h3>
            {riskProfile ? (
              <>
                <p
                  style={{
                    margin: 0,
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#0ea5e9",
                    textTransform: "capitalize",
                    letterSpacing: -0.5,
                  }}
                >
                  {riskProfile.riskAppetite}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-muted)" }}>
                  Updated {riskProfile.updatedAt.toLocaleDateString()}
                </p>
              </>
            ) : (
              <>
                <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
                  Take the risk profiling questionnaire to get personalized portfolio insights.
                </p>
                <Link
                  href="/user/settings#risk"
                  style={{
                    display: "inline-block",
                    marginTop: 10,
                    fontSize: 12,
                    color: "#0ea5e9",
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  Start questionnaire →
                </Link>
              </>
            )}
          </article>
        </div>
      </div>
    </section>
  );
}
