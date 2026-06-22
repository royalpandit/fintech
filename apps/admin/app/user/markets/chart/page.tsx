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

  return <TradingTerminal initialSymbol={initialSymbol} />;
}
