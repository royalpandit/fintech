import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuthToken } from "@/lib/auth";
import WalletActions from "@/components/paper/wallet-actions";
import PaperPortfolioSection from "@/components/paper/paper-portfolio-section";
import PaperTradeForm from "@/components/paper/paper-trade-form";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdvisorPaperPage() {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth || auth.role !== "advisor") redirect("/login");

  const wallet = await prisma.virtualWallet.findUnique({ where: { userId: auth.userId } });

  return (
    <section>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: "var(--text)" }}>Paper Trading</h1>
        <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 13 }}>
          Practice with virtual funds — separate from your advisor earnings wallet
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
        <WalletActions hasWallet={Boolean(wallet)} balance={Number(wallet?.balance ?? 0)} />
        <article className="card" style={{ padding: 18 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 800 }}>Quick trade</h3>
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
