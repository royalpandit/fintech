// Curated industry → representative NSE tickers. Used to filter the stocks
// list by sector. Matching is done on the normalized symbol (letters only), so
// "RELIANCE-EQ", "RELIANCE" and "Reliance" all match "RELIANCE".
export const MARKET_SECTORS: { key: string; label: string; tickers: string[] }[] = [
  { key: "ev", label: "EV", tickers: ["TATAMOTORS", "MM", "OLECTRA", "EXIDEIND", "AMARARAJA", "TATAPOWER"] },
  { key: "pharma", label: "Pharma", tickers: ["SUNPHARMA", "CIPLA", "DRREDDY", "DIVISLAB", "AUROPHARMA", "LUPIN", "BIOCON"] },
  { key: "banking", label: "Banking", tickers: ["HDFCBANK", "ICICIBANK", "SBIN", "KOTAKBANK", "AXISBANK", "INDUSINDBK", "BANKBARODA"] },
  { key: "it", label: "IT", tickers: ["TCS", "INFY", "WIPRO", "HCLTECH", "TECHM", "LTIM", "PERSISTENT"] },
  { key: "auto", label: "Auto", tickers: ["MARUTI", "TATAMOTORS", "MM", "BAJAJAUTO", "EICHERMOT", "HEROMOTOCO", "TVSMOTOR"] },
  { key: "fmcg", label: "FMCG", tickers: ["HINDUNILVR", "ITC", "NESTLEIND", "BRITANNIA", "DABUR", "MARICO", "GODREJCP"] },
  { key: "energy", label: "Energy", tickers: ["RELIANCE", "ONGC", "NTPC", "POWERGRID", "COALINDIA", "IOC", "BPCL"] },
  { key: "metals", label: "Metals", tickers: ["TATASTEEL", "JSWSTEEL", "HINDALCO", "VEDL", "JINDALSTEL", "SAIL", "NMDC"] },
];

export function normalizeTicker(s: string): string {
  return (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/EQ$|BE$/, "");
}

export function stockInSector(symbol: string, sectorKey: string): boolean {
  if (sectorKey === "all") return true;
  const sector = MARKET_SECTORS.find((s) => s.key === sectorKey);
  if (!sector) return true;
  const norm = normalizeTicker(symbol);
  return sector.tickers.some((t) => norm === t || norm.startsWith(t) || t.startsWith(norm));
}
