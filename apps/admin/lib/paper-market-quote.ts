import { getOHLC } from "@/lib/angelone";

export type QuoteInput = {
  symbol: string;
  token?: string | null;
  exchange?: string | null;
  tradingSymbol?: string | null;
};

/** Fetch live LTP for a single instrument (server-side). */
export async function fetchLiveLtp(input: QuoteInput): Promise<number> {
  const token = input.token?.trim();
  const exchange = (input.exchange || "NSE").toUpperCase();
  if (!token) {
    throw new Error("Market data token required for live price");
  }

  const results = await getOHLC([{ exchange, symboltoken: token }]);
  const q = results[0];
  const ltp = q?.ltp;
  if (ltp == null || !Number.isFinite(ltp) || ltp <= 0) {
    throw new Error(`Live price unavailable for ${input.symbol}`);
  }
  return ltp;
}

export function normalizePaperSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().split("-")[0].replace(/\.(NS|BO)$/i, "").replace(/\s+/g, "");
}
