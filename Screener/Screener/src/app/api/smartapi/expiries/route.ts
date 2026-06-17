import { NextResponse } from "next/server";
import { formatApiError } from "@/lib/smartapi/http";
import { getOptionExpiries } from "@/lib/smartapi/scrip-master";
import { normalizeSymbolQuery } from "@/lib/smartapi/symbols";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = normalizeSymbolQuery(searchParams.get("symbol") ?? "RELIANCE");
    const expiries = await getOptionExpiries(symbol);
    return NextResponse.json({ symbol, expiries });
  } catch (error) {
    return NextResponse.json(
      { error: formatApiError(error) },
      { status: 500 },
    );
  }
}
