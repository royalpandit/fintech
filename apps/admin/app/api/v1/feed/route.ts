import { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import {
  fetchUnifiedFeed,
  type UnifiedFeedKind,
  type UnifiedFeedSource,
} from "@/lib/unified-feed";

export const dynamic = "force-dynamic";

/**
 * The merged feed — advisor analysis and community posts in one stream,
 * follow-first then recency. Replaces the three separate tab feeds.
 *
 * Public: guests get the discover half (there is nothing to follow), which is
 * what the feed page already showed them.
 *
 *   GET /api/v1/feed?cursor=<phase:iso>&source=all|following|discover
 *                    &kinds=advisor,community&q=<search>
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req).catch(() => null);
  const userId = auth?.userId ?? null;

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const limit = Number(searchParams.get("limit") || 15);

  const rawSource = searchParams.get("source");
  const source: UnifiedFeedSource =
    rawSource === "following" || rawSource === "discover" ? rawSource : "all";

  const rawKinds = (searchParams.get("kinds") || "")
    .split(",")
    .map((k) => k.trim())
    .filter((k): k is UnifiedFeedKind => k === "advisor" || k === "community");

  try {
    const page = await fetchUnifiedFeed({
      userId,
      cursor,
      limit: Number.isFinite(limit) ? limit : 15,
      source,
      kinds: rawKinds,
      q: searchParams.get("q") ?? undefined,
    });
    return ok(page);
  } catch (e) {
    console.error("[GET /api/v1/feed]", e);
    return err("Could not load the feed", 500);
  }
}
