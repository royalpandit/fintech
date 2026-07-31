import { Suspense } from "react";
import UserCompetitionClient from "@/components/competition/user-competition-client";

// Advisors get the same Competitions experience investors do.
export default function AdvisorCompetitionPage() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <UserCompetitionClient />
    </Suspense>
  );
}
