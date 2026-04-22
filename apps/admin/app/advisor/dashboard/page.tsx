import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";

export default async function AdvisorDashboardPage() {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth || auth.role !== "advisor") redirect("/login");

  const [user, postCount, subscriberCount, latestMetrics] = await Promise.all([
    prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        fullName: true,
        advisorProfile: {
          select: { sebiRegistrationNo: true, verificationStatus: true, expertiseTags: true },
        },
      },
    }),
    prisma.marketPost.count({ where: { advisorUserId: auth.userId } }),
    prisma.subscription.count({ where: { advisorUserId: auth.userId, status: "active" } }),
    prisma.advisorMetricDaily.findFirst({
      where: { advisorUserId: auth.userId },
      orderBy: { day: "desc" },
    }),
  ]);

  if (!user) redirect("/login");

  if (user.advisorProfile?.verificationStatus !== "approved") {
    redirect("/advisor/pending");
  }

  return (
    <section style={{ maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ margin: 0, marginBottom: 8, fontSize: 28 }}>
        Welcome, {user.fullName.split(" ")[0]}
      </h1>
      <p style={{ margin: 0, marginBottom: 24, color: "#61708b" }}>
        SEBI {user.advisorProfile?.sebiRegistrationNo} · Verified advisor
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        <article style={{ background: "#fff", padding: 20, borderRadius: 14, border: "1px solid #e2e8f0" }}>
          <p style={{ margin: 0, marginBottom: 6, fontSize: 12, color: "#61708b", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Market Posts
          </p>
          <p style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>{postCount}</p>
        </article>
        <article style={{ background: "#fff", padding: 20, borderRadius: 14, border: "1px solid #e2e8f0" }}>
          <p style={{ margin: 0, marginBottom: 6, fontSize: 12, color: "#61708b", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Active Subscribers
          </p>
          <p style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>{subscriberCount}</p>
        </article>
        <article style={{ background: "#fff", padding: 20, borderRadius: 14, border: "1px solid #e2e8f0" }}>
          <p style={{ margin: 0, marginBottom: 6, fontSize: 12, color: "#61708b", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Accuracy (latest)
          </p>
          <p style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>
            {latestMetrics?.accuracyPct ? `${Number(latestMetrics.accuracyPct).toFixed(1)}%` : "—"}
          </p>
        </article>
      </div>

      <article style={{ background: "#fff", padding: 24, borderRadius: 14, border: "1px solid #e2e8f0" }}>
        <h3 style={{ margin: 0, marginBottom: 8, fontSize: 16 }}>Advisor tools</h3>
        <p style={{ margin: 0, color: "#61708b", fontSize: 14 }}>
          Full advisor console (post composer, course manager, subscriber analytics) will ship with the advisor web/mobile app. For now this dashboard confirms your verified status.
        </p>
      </article>
    </section>
  );
}
