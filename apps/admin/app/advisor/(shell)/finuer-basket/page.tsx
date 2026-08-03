import UserFinuerBasketClient from "@/components/finuer-basket/user-finuer-basket-client";

export const dynamic = "force-dynamic";

// Advisors get the same Finuer Basket experience investors do.
export default function AdvisorFinuerBasketPage() {
  return <UserFinuerBasketClient />;
}
