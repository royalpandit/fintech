import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/*
 * Option chain needs a broker feed.
 *
 * Yahoo Finance carries US-listed options only — every NSE/BSE ticker returns
 * an empty chain. NSE's own endpoint answers 200 with `{}` for non-browser
 * traffic, and harder-blocks datacenter IPs. So there is no free, no-auth
 * source for Indian option chains; it comes from the connected broker or not
 * at all. Quotes and candles are unaffected and run on Yahoo.
 */
export async function GET() {
  return NextResponse.json({
    ok: false,
    error: "Option chain requires a connected broker account.",
    data: null,
    authRequired: true,
  });
}
