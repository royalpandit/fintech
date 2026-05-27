"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  userId: number;
  status: string;
  emailVerified: boolean;
};

export default function UserRowActions({ userId, status, emailVerified }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const run = async (action: "verify" | "suspend" | "reactivate") => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok || data.status === false) {
        setError(data.error || "Action failed");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const btn: React.CSSProperties = {
    padding: "5px 10px",
    borderRadius: 6,
    border: "1px solid #eef0f4",
    background: "#fff",
    fontSize: 11,
    fontWeight: 700,
    cursor: loading ? "not-allowed" : "pointer",
    opacity: loading ? 0.6 : 1,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {!emailVerified && status !== "suspended" && (
          <button type="button" style={{ ...btn, background: "#7c3aed", color: "#fff", border: "none" }} disabled={loading} onClick={() => run("verify")}>
            Verify
          </button>
        )}
        {status === "suspended" ? (
          <button type="button" style={btn} disabled={loading} onClick={() => run("reactivate")}>
            Reactivate
          </button>
        ) : status !== "suspended" ? (
          <button type="button" style={{ ...btn, color: "#b91c1c" }} disabled={loading} onClick={() => run("suspend")}>
            Suspend
          </button>
        ) : null}
      </div>
      {error && <span style={{ fontSize: 10, color: "#b91c1c" }}>{error}</span>}
    </div>
  );
}
