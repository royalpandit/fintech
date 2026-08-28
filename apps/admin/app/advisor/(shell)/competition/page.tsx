import { Suspense } from "react";
import UserCompetitionClient from "@/components/competition/user-competition-client";
import { LoadingRows } from "@/components/loading-shimmer";

// Advisors get the same Competitions experience investors do.
export default function AdvisorCompetitionPage() {
  return (
    <Suspense fallback={<LoadingRows />}>
      <UserCompetitionClient />
    </Suspense>
  );
}
