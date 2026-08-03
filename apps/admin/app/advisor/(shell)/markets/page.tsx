import MarketsOverview from "@/components/trading/markets-overview";

export const dynamic = "force-dynamic";

// Advisors get the same Markets experience investors do.
export default function AdvisorMarketsPage() {
  return <MarketsOverview />;
}
