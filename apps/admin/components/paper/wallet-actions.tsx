"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const PRESETS = [50_000, 1_00_000, 5_00_000, 10_00_000];

type Props = {
  hasWallet: boolean;
  balance: number;
  score: number;
  unlocked: boolean;
  freeCap: number;
  unlockScore: number;
};

function formatINR(n: number) {
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default function WalletActions({
  hasWallet,
  balance,
  score,
  unlocked,
  freeCap,
  unlockScore,
}: Props) {
  const router = useRouter();
  const [amount, setAmount] = useState("100000");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const ensureWallet = async () => {
    const res = await fetch("/api/v1/lab/create", { method: "POST" });
    const data = await res.json();
    if (!res.ok || data.status === false) throw new Error(data.error || "Could not create wallet");
    return data;
  };

  const addFunds = async () => {
    setError("");
    setSuccess("");
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter a valid amount");
      return;
    }
    setLoading(true);
    try {
      if (!hasWallet) await ensureWallet();
      const res = await fetch("/api/v1/lab/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: value }),
      });
      const data = await res.json();
      if (!res.ok || data.status === false) {
        setError(data.error || "Failed to add funds");
        return;
      }
      setSuccess(`Added ${formatINR(value)}. New balance: ${formatINR(data.balance)}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  const createWallet = async () => {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const data = await ensureWallet();
      setSuccess(
        `Paper wallet ready with ${formatINR(data.virtual_balance ?? freeCap)} starting balance.`,
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: 42,
    padding: "0 14px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text)",
    boxSizing: "border-box",
  };

  return (
    <article
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: 20,
      }}
    >
      <h2 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 600, color: "var(--text)" }}>
        {hasWallet ? "Add virtual funds" : "Create paper wallet"}
      </h2>
      <p style={{ margin: "0 0 16px", fontSize: 12, color: "var(--text-muted)" }}>
        {hasWallet
          ? `Current balance: ${formatINR(balance)}. Top up for more paper trades.`
          : `Start with ${formatINR(freeCap)} demo balance — no real money.`}
      </p>

      {!hasWallet ? (
        <button
          type="button"
          onClick={createWallet}
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px 18px",
            borderRadius: 10,
            border: "none",
            background: "linear-gradient(135deg, #0ea5e9, #16a34a)",
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Creating…" : `Create wallet (${formatINR(freeCap)})`}
        </button>
      ) : (
        <>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
            Amount (₹)
          </label>
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={inputStyle}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0 10px" }}>
            {PRESETS.map((p) => {
              const exceedsCap = !unlocked && balance + p > freeCap;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAmount(String(p))}
                  disabled={exceedsCap}
                  title={exceedsCap ? `Reach Finuer score ${unlockScore} to unlock` : undefined}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: Number(amount) === p ? "rgba(14,165,233,0.12)" : "var(--surface-2)",
                    fontSize: 11,
                    fontWeight: 700,
                    color: exceedsCap ? "var(--text-muted)" : "#2563eb",
                    cursor: exceedsCap ? "not-allowed" : "pointer",
                    opacity: exceedsCap ? 0.5 : 1,
                  }}
                >
                  +{formatINR(p)}
                </button>
              );
            })}
          </div>

          {!unlocked && (
            <p style={{ margin: "0 0 14px", fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
              Balance is capped at <strong>{formatINR(freeCap)}</strong> until you reach a Finuer
              score of <strong>{unlockScore}</strong> (you&apos;re at <strong>{score}</strong>). Post
              and interact on Finuer to unlock higher balances.
            </p>
          )}
          <button
            type="button"
            onClick={addFunds}
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px 18px",
              borderRadius: 10,
              border: "none",
              background: "#0ea5e9",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Adding…" : "Add funds"}
          </button>
        </>
      )}

      {error && (
        <p style={{ margin: "12px 0 0", fontSize: 12, color: "#b91c1c", fontWeight: 600 }}>{error}</p>
      )}
      {success && (
        <p style={{ margin: "12px 0 0", fontSize: 12, color: "#047857", fontWeight: 600 }}>{success}</p>
      )}
    </article>
  );
}
