import { NextResponse } from "next/server";
import { formatApiError } from "@/lib/smartapi/http";
import { fetchLtp } from "@/lib/smartapi/market";
import { resolveSymbol } from "@/lib/smartapi/symbols";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbolQuery = searchParams.get("symbol") ?? "RELIANCE";

    const symbol = await resolveSymbol(symbolQuery);
    const quote = await fetchLtp(symbol);

    return NextResponse.json({ symbol, quote });
  } catch (error) {
    return NextResponse.json(
      { error: formatApiError(error) },
      { status: 500 },
    );
  }
}
