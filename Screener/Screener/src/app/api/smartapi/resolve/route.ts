import { NextResponse } from "next/server";
import { formatApiError } from "@/lib/smartapi/http";
import { resolveSymbol } from "@/lib/smartapi/symbols";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("symbol") ?? "RELIANCE";
    const symbol = await resolveSymbol(q);
    return NextResponse.json({ symbol });
  } catch (error) {
    return NextResponse.json(
      { error: formatApiError(error) },
      { status: 500 },
    );
  }
}
