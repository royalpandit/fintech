import { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-helpers";
import { listFundCategories, searchMutualFunds } from "@/lib/amfi";

export const dynamic = "force-dynamic";

/*
 * GET /api/v1/market/mutual-funds?q=…
 *
 * Mutual-fund search/browse backed by AMFI's free NAV feed.
 *
 * Public, like every other tab on the Markets page. This sat behind auth on the
 * assumption that the page was authed, which it is not — guests read indices,
 * charts and the option chain, so the Funds tab answered 401 and rendered
 * empty. Nothing here is per-user and AMFI costs no quota.
 */
export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  const q = params.get("q") ?? "";
  const category = params.get("category") ?? "";

  try {
    // Categories come from the whole feed, not from the 50 rows returned below,
    // so the dropdown offers every category that exists rather than only those
    // that happen to appear on the current page. Both come off the same cached
    // AMFI list, so this is one fetch, not two.
    const [funds, categories] = await Promise.all([
      searchMutualFunds(q, 50, category),
      listFundCategories(),
    ]);
    return ok({ funds, categories });
  } catch {
    return err("Couldn't reach the mutual-fund data source. Please try again.", 502);
  }
}
