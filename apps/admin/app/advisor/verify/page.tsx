import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import AdvisorVerifyForm from "./verify-form";

export const dynamic = "force-dynamic";

export default async function AdvisorVerifyPage() {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth) redirect("/login");

  const profile = await prisma.advisorProfile.findUnique({
    where: { userId: auth.userId },
    select: { sebiRegistrationNo: true, verificationFormSubmittedAt: true },
  });

  // Already verified → no need for the form.
  if (profile?.verificationFormSubmittedAt) redirect("/advisor/dashboard");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        color: "var(--text)",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 560 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            marginBottom: 16,
            borderRadius: 10,
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "var(--brand-danger)",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          ⚠ Your account is locked until verification is complete.
        </div>
        <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 600, letterSpacing: -0.2 }}>
          Advisor verification
        </h1>
        <p style={{ margin: "0 0 24px", color: "var(--text-muted)", fontSize: 14, lineHeight: 1.55 }}>
          Confirm that you&apos;re a government / SEBI-registered investment adviser.
          This unlocks publishing, subscriber monetization, and your verified badge.
        </p>
        <AdvisorVerifyForm initialSebi={profile?.sebiRegistrationNo ?? ""} />
      </div>
    </div>
  );
}
