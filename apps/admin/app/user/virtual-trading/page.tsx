import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TbRobot } from "react-icons/tb";
import { FiArrowRight } from "react-icons/fi";
import { requireAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import WalletActions from "@/components/paper/wallet-actions";
import PaperTradeForm from "@/components/paper/paper-trade-form";
import PaperPortfolioSection from "@/components/paper/paper-portfolio-section";
import { computeFinuerScore, FREE_BALANCE_CAP, UNLOCK_SCORE } from "@/lib/finuer-score";

export const dynamic = "force-dynamic";

/**
 * Virtual Trading — the investor counterpart to the advisor's /advisor/paper.
 *
 * The advisor console has had a single "Virtual Trading" workspace all along
 * (add funds + quick trade + holdings on one page) while the investor side had
 * the same three components scattered across Wallet and Portfolio, with no
 * entry point carrying the name. Same shared components, same order, so the two
 * panels behave identically.
 */
export default async function UserVirtualTradingPage({
  searchParams,
}: {
  searchParams?: { symbol?: string; side?: string };
}) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth) redirect("/login");

  // Deep-linked from the Buy/Sell shortcuts in Markets and the Watchlist.
  const presetSymbol = (searchParams?.symbol ?? "").trim().toUpperCase();
  const presetSide = searchParams?.side === "sell" ? "sell" : "buy";

  const [wallet, finuer] = await Promise.all([
    prisma.virtualWallet.findUnique({ where: { userId: auth.userId } }),
    computeFinuerScore(auth.userId),
  ]);

  return (
    <section className="user-page-section">
      <div className="page-head" style={{ marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "var(--text)", letterSpacing: -0.5 }}>
            Virtual Trading
          </h1>
          <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 13 }}>
            Practice with virtual funds — no real money is ever at risk
          </p>
        </div>

        {/* Route into the AI agents from the place people actually trade. The
            agents hub was previously only reachable from the sidebar. */}
        <Link
          href="/user/lab/agents"
          className="vt-ai-cta"
          aria-label="Get trade ideas from Financial AI Agents"
        >
          <TbRobot size={17} />
          <span>Ask an AI agent</span>
          <FiArrowRight size={14} />
        </Link>
      </div>

      <div className="user-split-2" style={{ marginBottom: 18 }}>
        <WalletActions
          hasWallet={Boolean(wallet)}
          balance={Number(wallet?.balance ?? 0)}
          score={finuer.score}
          unlocked={finuer.unlocked}
          freeCap={FREE_BALANCE_CAP}
          unlockScore={UNLOCK_SCORE}
        />
        <article
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: 20,
          }}
        >
          <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 600, color: "var(--text)" }}>
            {presetSymbol ? `Quick trade · ${presetSymbol}` : "Quick trade"}
          </h2>
          <PaperTradeForm compact defaultSymbol={presetSymbol} defaultSide={presetSide} />
          <p style={{ margin: "12px 0 0", fontSize: 11, color: "var(--text-muted)" }}>
            Enter any NSE symbol and price to simulate buys and sells.
          </p>
        </article>
      </div>

      {/* The Quick trade card above is this page's order entry — the section
          would otherwise render a second, identical form underneath. */}
      <PaperPortfolioSection userId={auth.userId} showTradeForm={false} />
    </section>
  );
}
