import { NextResponse } from "next/server";
import { formatApiError } from "@/lib/smartapi/http";
import { buildOptionChain, fetchOptionGreeks } from "@/lib/smartapi/options";
import { getOptionExpiries } from "@/lib/smartapi/scrip-master";
import { normalizeSymbolQuery } from "@/lib/smartapi/symbols";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = normalizeSymbolQuery(searchParams.get("symbol") ?? "RELIANCE");
    let expiry = searchParams.get("expiry");

    if (!expiry) {
      const expiries = await getOptionExpiries(symbol);
      expiry = expiries[0];
      if (!expiry) {
        return NextResponse.json(
          { error: "No option expiries found for this symbol" },
          { status: 404 },
        );
      }
    }

    const greeks = await fetchOptionGreeks(symbol, expiry);
    const chain = buildOptionChain(greeks);

    return NextResponse.json({
      symbol,
      expiry,
      spot: null,
      chain,
    });
  } catch (error) {
    return NextResponse.json(
      { error: formatApiError(error) },
      { status: 500 },
    );
  }
}
