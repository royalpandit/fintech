import UserFinuerBasketDetailClient from "@/components/finuer-basket/user-finuer-basket-detail";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function UserFinuerBasketDetailPage() {
  return (
    <Suspense fallback={<p style={{ padding: 24 }}>Loading…</p>}>
      <UserFinuerBasketDetailClient />
    </Suspense>
  );
}
