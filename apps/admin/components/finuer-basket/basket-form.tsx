"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Btn, Field, Panel, finuerBasketApi, inputStyle } from "@/components/finuer-basket/admin-ui";

type Market = { id: number; name: string };
type BasketType = { id: number; name: string };
type Benchmark = { id: number; marketId: number; name: string };

export default function BasketFormPage({ basketId }: { basketId?: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEdit = Boolean(basketId);
  const viewOnly = isEdit && searchParams.get("edit") !== "1";

  const [markets, setMarkets] = useState<Market[]>([]);
  const [types, setTypes] = useState<BasketType[]>([]);
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [basketName, setBasketName] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [methodology, setMethodology] = useState("");
  const [marketId, setMarketId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [benchmarkId, setBenchmarkId] = useState("");
  const [status, setStatus] = useState("active");
  const [visibility, setVisibility] = useState("public");
  const [rebalanceFrequency, setRebalanceFrequency] = useState("monthly");
  const [requiredPlan, setRequiredPlan] = useState("free");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredBenchmarks = useMemo(
    () => benchmarks.filter((b) => !marketId || String(b.marketId) === marketId),
    [benchmarks, marketId],
  );

  async function loadMeta() {
    const [m, t, b] = await Promise.all([
      finuerBasketApi("/api/v1/admin/markets"),
      finuerBasketApi("/api/v1/admin/types"),
      finuerBasketApi("/api/v1/admin/benchmarks"),
    ]);
    const mj = await m.json();
    const tj = await t.json();
    const bj = await b.json();
    if (mj.ok) setMarkets(mj.data);
    if (tj.ok) setTypes(tj.data);
    if (bj.ok) setBenchmarks(bj.data);
  }

  async function loadBasket() {
    if (!basketId) return;
    const r = await finuerBasketApi(`/api/v1/admin/baskets/${basketId}`);
    const j = await r.json();
    if (!j.ok) return;
    const d = j.data;
    setBasketName(d.basketName);
    setShortDescription(d.shortDescription ?? "");
    setMethodology(d.methodology ?? "");
    setMarketId(String(d.marketId));
    setTypeId(String(d.typeId));
    setBenchmarkId(String(d.benchmarkId));
    setStatus(d.status);
    setVisibility(d.visibility);
    setRebalanceFrequency(d.rebalanceFrequency);
    setRequiredPlan(d.requiredPlan);
  }

  useEffect(() => {
    loadMeta();
    loadBasket();
  }, [basketId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (viewOnly) return;
    if (!basketName.trim() || !marketId || !typeId || !benchmarkId) {
      setError("Basket name, market, type, and benchmark are required");
      return;
    }
    if (!shortDescription.trim()) {
      setError("Short description is required");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      basketName,
      shortDescription,
      methodology,
      marketId: Number(marketId),
      typeId: Number(typeId),
      benchmarkId: Number(benchmarkId),
      status,
      visibility,
      rebalanceFrequency,
      requiredPlan,
    };
    const r = await finuerBasketApi(
      isEdit ? `/api/v1/admin/baskets/${basketId}` : "/api/v1/admin/baskets",
      { method: isEdit ? "PUT" : "POST", body: JSON.stringify(payload) },
    );
    const j = await r.json();
    setSaving(false);
    if (!j.ok) {
      setError(j.error || "Failed to save");
      return;
    }
    router.push(
      isEdit
        ? "/super-admin/finuer-basket/baskets"
        : `/super-admin/finuer-basket/baskets/${j.data.id}/stocks`,
    );
  }

  const disabled = viewOnly;

  return (
    <Panel title={isEdit ? (viewOnly ? "View Basket" : "Edit Basket") : "Create Basket"}>
      {!isEdit ? (
        <p style={{ margin: "0 0 14px", fontSize: 12, color: "var(--text-muted)" }}>
          Step 1 of 2 — After saving, add constituent stocks (weights must total 100%). Returns are
          calculated automatically from holdings.
        </p>
      ) : null}
      <form onSubmit={onSubmit}>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <Field label="Basket Name *">
            <input
              style={inputStyle}
              disabled={disabled}
              value={basketName}
              onChange={(e) => setBasketName(e.target.value)}
            />
          </Field>
          <Field label="Market *">
            <select
              style={inputStyle}
              disabled={disabled}
              value={marketId}
              onChange={(e) => {
                setMarketId(e.target.value);
                setBenchmarkId("");
              }}
            >
              <option value="">Select market</option>
              {markets.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Type *">
            <select style={inputStyle} disabled={disabled} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              <option value="">Select type</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Benchmark *">
            <select
              style={inputStyle}
              disabled={disabled}
              value={benchmarkId}
              onChange={(e) => setBenchmarkId(e.target.value)}
            >
              <option value="">Select benchmark</option>
              {filteredBenchmarks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select style={inputStyle} disabled={disabled} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
          <Field label="Required Plan">
            <select
              style={inputStyle}
              disabled={disabled}
              value={requiredPlan}
              onChange={(e) => setRequiredPlan(e.target.value)}
            >
              <option value="free">Free</option>
              <option value="premium">Premium</option>
            </select>
          </Field>
          <Field label="Rebalance Frequency">
            <select
              style={inputStyle}
              disabled={disabled}
              value={rebalanceFrequency}
              onChange={(e) => setRebalanceFrequency(e.target.value)}
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </Field>
        </div>

        <Field label="Short Description *">
          <textarea
            style={{ ...inputStyle, minHeight: 72 }}
            disabled={disabled}
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
            placeholder="Brief summary shown on basket cards"
          />
        </Field>

        <Field label="Methodology">
          <textarea
            style={{ ...inputStyle, minHeight: 160 }}
            disabled={disabled}
            value={methodology}
            onChange={(e) => setMethodology(e.target.value)}
            placeholder="Investment approach, stock selection criteria, risk profile, rebalancing rules…"
          />
        </Field>

        {isEdit && !viewOnly ? (
          <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
            Performance returns are system-calculated from holdings — use Manage Stocks → Recalculate
            Performance after updating weights.
          </p>
        ) : null}

        {error ? <p style={{ color: "#ef4444", fontSize: 12 }}>{error}</p> : null}

        {!viewOnly ? (
          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 24,
              paddingTop: 16,
              paddingBottom: 8,
              borderTop: "1px solid var(--border)",
              position: "sticky",
              bottom: 0,
              background: "var(--surface)",
              zIndex: 2,
            }}
          >
            <Btn type="submit" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Update Basket" : "Save & Add Stocks"}
            </Btn>
            <Btn type="button" variant="ghost" onClick={() => router.push("/super-admin/finuer-basket/baskets")}>
              Cancel
            </Btn>
          </div>
        ) : null}
      </form>
    </Panel>
  );
}
