"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import FinuerBasketCard, { type FinuerBasketCardData } from "@/components/finuer-basket/finuer-basket-card";
import type { FinuerBasketTimePeriod } from "@/lib/finuer-basket";
import { UserPageBackLink, UserPageHeader, UserPageSection } from "@/components/user/user-page-layout";

type Stock = {
  id: number;
  symbol: string;
  stockName: string;
  exchange: string;
  weightPct: number | null;
  cmp: number | null;
};

type BasketDetail = FinuerBasketCardData & { stocks: Stock[] };

export default function UserFinuerBasketDetailClient() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const timePeriod = (searchParams.get("time_period") as FinuerBasketTimePeriod) || "1_year";

  const [basket, setBasket] = useState<BasketDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const r = await fetch(`/api/v1/baskets/${id}?time_period=${timePeriod}`);
      const j = await r.json();
      if (j.ok) setBasket(j.data);
      setLoading(false);
    }
    load();
  }, [id, timePeriod]);

  if (loading) {
    return (
      <UserPageSection>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading basket…</p>
      </UserPageSection>
    );
  }

  if (!basket) {
    return (
      <UserPageSection>
        <UserPageBackLink href="/user/finuer-basket">← Back to Finuer Basket</UserPageBackLink>
        <p style={{ marginTop: 16 }}>Basket not found.</p>
      </UserPageSection>
    );
  }

  const totalWeight = (basket.stocks ?? []).reduce((s, x) => s + (x.weightPct ?? 0), 0);

  return (
    <UserPageSection>
      <UserPageBackLink href="/user/finuer-basket">← Back to Finuer Basket</UserPageBackLink>

      <div style={{ marginTop: 12, marginBottom: 16 }}>
        <FinuerBasketCard basket={basket} timePeriod={timePeriod} linkable={false} />
      </div>

      <UserPageHeader
        title="Constituent Stocks"
        subtitle={`${basket.stocks?.length ?? 0} stocks${totalWeight > 0 ? ` · ${totalWeight.toFixed(1)}% weight allocated` : ""}`}
      />

      {!basket.stocks?.length ? (
        <div className="user-page-empty">
          <p style={{ margin: 0 }}>Stock composition will be published soon.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {basket.stocks.map((stock) => (
            <article key={stock.id} className="user-page-card" style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <strong style={{ fontSize: 14 }}>{stock.symbol}</strong>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", padding: "2px 8px", borderRadius: 999, border: "1px solid var(--border)" }}>
                      {stock.exchange}
                    </span>
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>{stock.stockName}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  {stock.weightPct != null ? (
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{stock.weightPct}%</div>
                  ) : null}
                  {stock.cmp != null ? (
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      CMP ₹{stock.cmp.toLocaleString("en-IN")}
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </UserPageSection>
  );
}
