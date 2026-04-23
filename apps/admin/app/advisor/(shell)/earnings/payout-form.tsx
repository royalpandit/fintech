"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

function formatINR(n: number) {
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

export default function PayoutRequestForm({
  balance,
  hasPendingRequest,
  pendingAmount,
}: {
  balance: number;
  hasPendingRequest: boolean;
  pendingAmount: number | null;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await fetch("/api/v1/advisor/payout-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          destinationType: "bank",
          destinationDetails: {
            accountName: accountName.trim(),
            accountNumber: accountNumber.trim(),
            ifsc: ifsc.trim().toUpperCase(),
          },
        }),
      });
      const data = await response.json();
      if (!response.ok || data.status === false) {
        setError(data.error || "Request failed");
        setLoading(false);
        return;
      }
      setSuccess("Payout requested. You'll be notified once it's processed.");
      setAmount("");
      setAccountName("");
      setAccountNumber("");
      setIfsc("");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  if (hasPendingRequest) {
    return (
      <article className="card">
        <h3 style={{ marginTop: 0 }}>Payout Pending</h3>
        <p className="page-subtitle" style={{ margin: 0 }}>
          You have a payout of{" "}
          <strong>{pendingAmount ? formatINR(pendingAmount) : "—"}</strong> being processed.
          You can request another payout after this one is resolved.
        </p>
      </article>
    );
  }

  if (balance < 500) {
    return (
      <article className="card">
        <h3 style={{ marginTop: 0 }}>Request Payout</h3>
        <p className="page-subtitle" style={{ margin: 0 }}>
          Minimum payout is <strong>₹500</strong>. Your current balance is{" "}
          <strong>{formatINR(balance)}</strong>.
        </p>
      </article>
    );
  }

  return (
    <article className="card">
      <h3 style={{ marginTop: 0 }}>Request Payout</h3>
      <p className="page-subtitle" style={{ marginTop: 0 }}>
        Available: <strong>{formatINR(balance)}</strong>
      </p>

      <form onSubmit={submit}>
        <label className="metric-label" style={{ marginTop: 8 }}>
          Amount (₹)
        </label>
        <input
          className="input"
          type="number"
          min={500}
          max={balance}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 5000"
          required
        />

        <label className="metric-label" style={{ marginTop: 12 }}>
          Account Holder Name
        </label>
        <input
          className="input"
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          required
        />

        <label className="metric-label" style={{ marginTop: 12 }}>
          Account Number
        </label>
        <input
          className="input"
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value)}
          required
        />

        <label className="metric-label" style={{ marginTop: 12 }}>
          IFSC Code
        </label>
        <input
          className="input"
          value={ifsc}
          onChange={(e) => setIfsc(e.target.value.toUpperCase())}
          placeholder="e.g. HDFC0001234"
          required
        />

        {error && (
          <div
            style={{
              marginTop: 12,
              padding: "8px 10px",
              background: "#fef2f2",
              color: "#b91c1c",
              borderRadius: 8,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}
        {success && (
          <div
            style={{
              marginTop: 12,
              padding: "8px 10px",
              background: "#f0fdf4",
              color: "#047857",
              borderRadius: 8,
              fontSize: 13,
            }}
          >
            {success}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary"
          style={{ width: "100%", marginTop: 14, padding: 12 }}
        >
          {loading ? "Requesting..." : "Request Payout"}
        </button>
      </form>
    </article>
  );
}
