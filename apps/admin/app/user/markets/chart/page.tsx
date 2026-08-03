import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";
import TradingTerminal from "@/components/trading/trading-terminal";
import type { WatchlistItem } from "@/components/trading/trading-terminal-types";

export const dynamic = "force-dynamic";

export default function MarketsChartPage({
  searchParams,
}: {
  searchParams: { symbol?: string; token?: string; exchange?: string; type?: string };
}) {
  const { symbol, token, exchange, type } = searchParams;

  const initialSymbol: WatchlistItem | undefined =
    symbol && token && exchange
      ? {
          display: symbol,
          tradingSymbol: symbol,
          token,
          exchange,
          type: type || "EQ",
        }
      : undefined;

  return (
    <div>
      <Link href="/user/markets" className="user-page-back-link" style={{ marginBottom: 10 }}>
        <span className="user-page-back-icon"><FiArrowLeft size={14} /></span>
        Back to Markets
      </Link>
      <TradingTerminal initialSymbol={initialSymbol} />
    </div>
  );
}
