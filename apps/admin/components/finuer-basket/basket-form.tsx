"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Btn, Field, Panel, finuerBasketApi, inputStyle } from "@/components/finuer-basket/admin-ui";

type Market = { id: number; name: string };
type BasketType = { id: number; name: string };
type Benchmark = { id: number; marketId: number; name: string };

const emptyPerf = () => ({
  oneMonthReturn: "",
  threeMonthReturn: "",
  sixMonthReturn: "",
  oneYearReturn: "",
  threeYearReturn: "",
  fiveYearReturn: "",
  sinceLaunchReturn: "",
  benchmarkOneMonth: "",
  benchmarkThreeMonth: "",
  benchmarkSixMonth: "",
  benchmarkOneYear: "",
  benchmarkThreeYear: "",
  benchmarkFiveYear: "",
  benchmarkSinceLaunch: "",
});

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
  const [marketId, setMarketId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [benchmarkId, setBenchmarkId] = useState("");
  const [status, setStatus] = useState("active");
  const [visibility, setVisibility] = useState("public");
  const [rebalanceFrequency, setRebalanceFrequency] = useState("monthly");
  const [requiredPlan, setRequiredPlan] = useState("free");
  const [perf, setPerf] = useState(emptyPerf());
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
    setMarketId(String(d.marketId));
    setTypeId(String(d.typeId));
    setBenchmarkId(String(d.benchmarkId));
    setStatus(d.status);
    setVisibility(d.visibility);
    setRebalanceFrequency(d.rebalanceFrequency);
    setRequiredPlan(d.requiredPlan);
    const p = d.performance ?? {};
    setPerf({
      oneMonthReturn: p.oneMonthReturn ?? "",
      threeMonthReturn: p.threeMonthReturn ?? "",
      sixMonthReturn: p.sixMonthReturn ?? "",
      oneYearReturn: p.oneYearReturn ?? "",
      threeYearReturn: p.threeYearReturn ?? "",
      fiveYearReturn: p.fiveYearReturn ?? "",
      sinceLaunchReturn: p.sinceLaunchReturn ?? "",
      benchmarkOneMonth: p.benchmarkOneMonth ?? "",
      benchmarkThreeMonth: p.benchmarkThreeMonth ?? "",
      benchmarkSixMonth: p.benchmarkSixMonth ?? "",
      benchmarkOneYear: p.benchmarkOneYear ?? "",
      benchmarkThreeYear: p.benchmarkThreeYear ?? "",
      benchmarkFiveYear: p.benchmarkFiveYear ?? "",
      benchmarkSinceLaunch: p.benchmarkSinceLaunch ?? "",
    });
  }

  useEffect(() => {
    loadMeta();
    loadBasket();
  }, [basketId]);

  function numOrNull(v: string) {
    if (v === "" || v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (viewOnly) return;
    if (!basketName.trim() || !marketId || !typeId || !benchmarkId) {
      setError("Basket name, market, type, and benchmark are required");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      basketName,
      shortDescription,
      marketId: Number(marketId),
      typeId: Number(typeId),
      benchmarkId: Number(benchmarkId),
      status,
      visibility,
      rebalanceFrequency,
      requiredPlan,
      performance: {
        oneMonthReturn: numOrNull(perf.oneMonthReturn),
        threeMonthReturn: numOrNull(perf.threeMonthReturn),
        sixMonthReturn: numOrNull(perf.sixMonthReturn),
        oneYearReturn: numOrNull(perf.oneYearReturn),
        threeYearReturn: numOrNull(perf.threeYearReturn),
        fiveYearReturn: numOrNull(perf.fiveYearReturn),
        sinceLaunchReturn: numOrNull(perf.sinceLaunchReturn),
        benchmarkOneMonth: numOrNull(perf.benchmarkOneMonth),
        benchmarkThreeMonth: numOrNull(perf.benchmarkThreeMonth),
        benchmarkSixMonth: numOrNull(perf.benchmarkSixMonth),
        benchmarkOneYear: numOrNull(perf.benchmarkOneYear),
        benchmarkThreeYear: numOrNull(perf.benchmarkThreeYear),
        benchmarkFiveYear: numOrNull(perf.benchmarkFiveYear),
        benchmarkSinceLaunch: numOrNull(perf.benchmarkSinceLaunch),
      },
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
          Step 1 of 2 — After saving, you will add constituent stocks (symbol, weight, CMP).
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
          <Field label="Visibility">
            <select
              style={inputStyle}
              disabled={disabled}
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
            >
              <option value="public">Public</option>
              <option value="hidden">Hidden</option>
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
        </div>

        <Field label="Short Description">
          <textarea
            style={{ ...inputStyle, minHeight: 80 }}
            disabled={disabled}
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
          />
        </Field>

        <h3 style={{ fontSize: 14, fontWeight: 800, margin: "16px 0 10px" }}>Performance Returns (%)</h3>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          {(
            [
              ["oneMonthReturn", "1 Month"],
              ["threeMonthReturn", "3 Months"],
              ["sixMonthReturn", "6 Months"],
              ["oneYearReturn", "1 Year"],
              ["threeYearReturn", "3 Years"],
              ["fiveYearReturn", "5 Years"],
              ["sinceLaunchReturn", "Since Launch"],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={`Basket ${label}`}>
              <input
                style={inputStyle}
                disabled={disabled}
                type="number"
                step="0.01"
                value={perf[key]}
                onChange={(e) => setPerf((p) => ({ ...p, [key]: e.target.value }))}
              />
            </Field>
          ))}
        </div>

        <h3 style={{ fontSize: 14, fontWeight: 800, margin: "16px 0 10px" }}>Benchmark Returns (%)</h3>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          {(
            [
              ["benchmarkOneMonth", "1 Month"],
              ["benchmarkThreeMonth", "3 Months"],
              ["benchmarkSixMonth", "6 Months"],
              ["benchmarkOneYear", "1 Year"],
              ["benchmarkThreeYear", "3 Years"],
              ["benchmarkFiveYear", "5 Years"],
              ["benchmarkSinceLaunch", "Since Launch"],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={`Benchmark ${label}`}>
              <input
                style={inputStyle}
                disabled={disabled}
                type="number"
                step="0.01"
                value={perf[key]}
                onChange={(e) => setPerf((p) => ({ ...p, [key]: e.target.value }))}
              />
            </Field>
          ))}
        </div>

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
              {saving ? "Saving…" : isEdit ? "Update Basket" : "Save Basket"}
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
