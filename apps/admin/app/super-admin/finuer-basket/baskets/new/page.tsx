import BasketFormPage from "@/components/finuer-basket/basket-form";
import { Suspense } from "react";
import { LoadingRows } from "@/components/loading-shimmer";

export default function CreateBasketPage() {
  return (
    <Suspense fallback={<LoadingRows />}>
      <BasketFormPage />
    </Suspense>
  );
}
