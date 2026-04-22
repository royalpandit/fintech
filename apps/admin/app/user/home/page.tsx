import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";

export default async function UserHomePage() {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth) redirect("/login");

  const [user, portfolioCount, followingCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: auth.userId },
      select: { fullName: true, email: true, createdAt: true },
    }),
    prisma.portfolio.count({ where: { userId: auth.userId } }),
    prisma.userFollow.count({ where: { followerUserId: auth.userId } }),
  ]);

  if (!user) redirect("/login");

  return (
    <section style={{ maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ margin: 0, marginBottom: 8, fontSize: 28 }}>
        Welcome, {user.fullName.split(" ")[0]}
      </h1>
      <p style={{ margin: 0, marginBottom: 24, color: "#61708b" }}>
        The Corescent mobile app is where most of the action happens — portfolio sync, UPI insights, virtual lab, and the advisor feed.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        <article style={{ background: "#fff", padding: 20, borderRadius: 14, border: "1px solid #e2e8f0" }}>
          <p style={{ margin: 0, marginBottom: 6, fontSize: 12, color: "#61708b", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Portfolios Linked
          </p>
          <p style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>{portfolioCount}</p>
        </article>
        <article style={{ background: "#fff", padding: 20, borderRadius: 14, border: "1px solid #e2e8f0" }}>
          <p style={{ margin: 0, marginBottom: 6, fontSize: 12, color: "#61708b", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Following
          </p>
          <p style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>{followingCount}</p>
        </article>
        <article style={{ background: "#fff", padding: 20, borderRadius: 14, border: "1px solid #e2e8f0" }}>
          <p style={{ margin: 0, marginBottom: 6, fontSize: 12, color: "#61708b", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Member Since
          </p>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
            {user.createdAt.toLocaleDateString("en-US", { month: "short", year: "numeric" })}
          </p>
        </article>
      </div>

      <article style={{ background: "#fff", padding: 24, borderRadius: 14, border: "1px solid #e2e8f0" }}>
        <h3 style={{ margin: 0, marginBottom: 8, fontSize: 16 }}>Next steps</h3>
        <ul style={{ margin: 0, paddingLeft: 18, color: "#334155", fontSize: 14, lineHeight: 1.8 }}>
          <li>Install the Corescent mobile app to complete KYC and link your portfolio.</li>
          <li>Connect a UPI account to start tracking expenses automatically.</li>
          <li>Start with ₹10L of virtual capital in the Investment Lab — no real money required.</li>
          <li>Follow a SEBI-verified advisor to get market sentiment updates.</li>
        </ul>
      </article>
    </section>
  );
}
