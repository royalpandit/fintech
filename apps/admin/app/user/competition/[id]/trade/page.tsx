import { Suspense } from "react";
import UserCompetitionTradeClient from "@/components/competition/user-competition-trade";

export default function UserCompetitionTradePage() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <UserCompetitionTradeClient />
    </Suspense>
  );
}
