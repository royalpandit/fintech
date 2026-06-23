import BasketFormPage from "@/components/finuer-basket/basket-form";
import { Suspense } from "react";

type Props = { params: Promise<{ id: string }> };

export default async function ViewEditBasketPage({ params }: Props) {
  const { id } = await params;
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <BasketFormPage basketId={Number(id)} />
    </Suspense>
  );
}
