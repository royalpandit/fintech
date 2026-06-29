"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function SubscriptionsFilters({
  initialQ,
  initialStatus,
  initialPlan,
}: {
  initialQ: string;
  initialStatus: string;
  initialPlan: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [status, setStatus] = useState(initialStatus);
  const [plan, setPlan] = useState(initialPlan);

  const apply = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (status) params.set("status", status);
    if (plan) params.set("plan", plan);
    const query = params.toString();
    router.push(`/super-admin/subscriptions${query ? `?${query}` : ""}`);
  };

  const reset = () => {
    setQ("");
    setStatus("");
    setPlan("");
    router.push("/super-admin/subscriptions");
  };

  return (
    <form onSubmit={apply}>
      <article className="card" style={{ marginTop: 16 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 160px 150px auto auto",
            gap: 12,
            alignItems: "center",
          }}
        >
          <input
            className="input"
            placeholder="Search subscriber, advisor, or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
            <option value="pending">Pending</option>
          </select>
          <select className="input" value={plan} onChange={(e) => setPlan(e.target.value)}>
            <option value="">All plans</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
            <option value="free">Free follow</option>
          </select>
          <button type="submit" className="btn-primary">
            Apply
          </button>
          <button
            type="button"
            className="input"
            style={{ width: "auto", padding: "12px 18px" }}
            onClick={reset}
          >
            Reset
          </button>
        </div>
      </article>
    </form>
  );
}
