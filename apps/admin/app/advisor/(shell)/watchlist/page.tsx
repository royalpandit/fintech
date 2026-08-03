import WatchlistPageClient from "@/components/watchlist/watchlist-page-client";

export const dynamic = "force-dynamic";

// Advisors are always authenticated inside the advisor shell, so render the
// investor watchlist client directly (no AuthGate needed).
export default function AdvisorWatchlistPage() {
  return <WatchlistPageClient />;
}
