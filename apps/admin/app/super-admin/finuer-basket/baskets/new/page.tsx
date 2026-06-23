import BasketFormPage from "@/components/finuer-basket/basket-form";
import { Suspense } from "react";

export default function CreateBasketPage() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <BasketFormPage />
    </Suspense>
  );
}
