import { NextResponse } from "next/server";
import { formatApiError } from "@/lib/smartapi/http";
import { searchNseEquity } from "@/lib/smartapi/symbols";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? "";

    const results = await searchNseEquity(q);
    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      { error: formatApiError(error) },
      { status: 500 },
    );
  }
}
