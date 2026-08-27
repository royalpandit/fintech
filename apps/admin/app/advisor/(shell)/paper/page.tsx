import Link from "next/link";
import { TbRobot } from "react-icons/tb";
import { FiArrowRight } from "react-icons/fi";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuthToken } from "@/lib/auth";
import WalletActions from "@/components/paper/wallet-actions";
import PaperPortfolioSection from "@/components/paper/paper-portfolio-section";
import PaperTradeForm from "@/components/paper/paper-trade-form";
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
      <div className="page-head" style={{ marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, color: "var(--text)" }}>Paper Trading</h1>
          <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 13 }}>
            Practice with virtual funds — separate from your advisor earnings wallet
          </p>
        </div>

        {/* Same route into the AI agents the investor panel has, so both sides
            can reach them from where trading decisions actually happen. */}
        <Link
          href="/advisor/agents"
          className="vt-ai-cta"
          aria-label="Get trade ideas from Financial AI Agents"
        >
          <TbRobot size={17} />
          <span>Ask an AI agent</span>
          <FiArrowRight size={14} />
        </Link>
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
          <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600 }}>Quick trade</h3>
          <PaperTradeForm compact />
          <p style={{ margin: "12px 0 0", fontSize: 11, color: "var(--text-muted)" }}>
            Enter any NSE symbol and price to simulate buys and sells.
          </p>
        </article>
      </div>

      <PaperPortfolioSection userId={auth.userId} />
    </section>
  );
}
