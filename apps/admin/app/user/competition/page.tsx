import { Suspense } from "react";
import UserCompetitionClient from "@/components/competition/user-competition-client";

export default function UserCompetitionPage() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <UserCompetitionClient />
    </Suspense>
  );
}
