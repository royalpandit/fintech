import { Suspense } from "react";
import UserCompetitionClient from "@/components/competition/user-competition-client";
import { LoadingRows } from "@/components/loading-shimmer";

export default function UserCompetitionPage() {
  return (
    <Suspense fallback={<LoadingRows />}>
      <UserCompetitionClient />
    </Suspense>
  );
}
