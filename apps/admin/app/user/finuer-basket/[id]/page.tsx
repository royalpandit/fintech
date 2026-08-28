import UserFinuerBasketDetailClient from "@/components/finuer-basket/user-finuer-basket-detail";
import { Suspense } from "react";
import { LoadingRows } from "@/components/loading-shimmer";

export const dynamic = "force-dynamic";

export default function UserFinuerBasketDetailPage() {
  return (
    <Suspense fallback={<LoadingRows />}>
      <UserFinuerBasketDetailClient />
    </Suspense>
  );
}
