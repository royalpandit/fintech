import { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import { searchMutualFunds } from "@/lib/amfi";

export const dynamic = "force-dynamic";

// GET /api/v1/market/mutual-funds?q=…
// Mutual-fund search/browse backed by AMFI's free NAV feed.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const q = new URL(req.url).searchParams.get("q") ?? "";
  try {
    const funds = await searchMutualFunds(q, 50);
    return ok({ funds });
  } catch {
    return err("Couldn't reach the mutual-fund data source. Please try again.", 502);
  }
}
