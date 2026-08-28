import BasketFormPage from "@/components/finuer-basket/basket-form";
import { Suspense } from "react";
import { LoadingRows } from "@/components/loading-shimmer";

type Props = { params: Promise<{ id: string }> };

export default async function ViewEditBasketPage({ params }: Props) {
  const { id } = await params;
  return (
    <Suspense fallback={<LoadingRows />}>
      <BasketFormPage basketId={Number(id)} />
    </Suspense>
  );
}
