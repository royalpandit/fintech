import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuthToken } from "@/lib/auth";
import WalletActions from "@/components/paper/wallet-actions";
import PaperPortfolioSection from "@/components/paper/paper-portfolio-section";
import { prisma } from "@/lib/prisma";
import { computeFinuerScore, FREE_BALANCE_CAP, UNLOCK_SCORE } from "@/lib/finuer-score";

export const dynamic = "force-dynamic";

export default async function AdvisorPaperPage() {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth || auth.role !== "advisor") redirect("/login");

  const wallet = await prisma.virtualWallet.findUnique({ where: { userId: auth.userId } });
  const finuer = await computeFinuerScore(auth.userId);

  return (
    <section>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, color: "var(--text)" }}>Paper Trading</h1>
        <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 13 }}>
          Practice with virtual funds — separate from your advisor earnings wallet
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
        <WalletActions
          hasWallet={Boolean(wallet)}
          balance={Number(wallet?.balance ?? 0)}
          score={finuer.score}
          unlocked={finuer.unlocked}
          freeCap={FREE_BALANCE_CAP}
          unlockScore={UNLOCK_SCORE}
        />
        <article className="card" style={{ padding: 18 }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
            Virtual Fund Limits
          </h3>
          <p style={{ margin: "0 0 14px", fontSize: 12, color: "var(--text-muted)" }}>
            How to increase your paper trading balance.
          </p>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-2)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>Free Plan</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0ea5e9" }}>₹5,00,000</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Default limit for all advisors</div>
            </div>
            <div style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(124,58,237,0.3)", background: "rgba(124,58,237,0.06)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed", marginBottom: 2 }}>Earn via Score</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#7c3aed" }}>Unlimited</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                Reach Finuer score {UNLOCK_SCORE}+ by posting &amp; engaging
                {" · "}your score: <strong style={{ color: finuer.unlocked ? "#16a34a" : "var(--text)" }}>{finuer.score}</strong>
              </div>
            </div>
            <div style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.06)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#d97706", marginBottom: 2 }}>Paid Plans</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#d97706" }}>₹25L – ₹1Cr</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Upgrade your advisor plan for higher limits</div>
            </div>
          </div>
        </article>
      </div>

      <PaperPortfolioSection userId={auth.userId} />
    </section>
  );
}
