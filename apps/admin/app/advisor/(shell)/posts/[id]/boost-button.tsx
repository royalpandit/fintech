"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiTrendingUp } from "react-icons/fi";
import BoostPicker from "@/components/posts/boost-picker";
import { isBoostActive, type BoostTierId } from "@/lib/post-boost";

export default function BoostButton({
  postId,
  boostedUntil,
  approved,
}: {
  postId: number;
  boostedUntil: string | null;
  approved: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tier, setTier] = useState<BoostTierId | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const active = isBoostActive(boostedUntil);
  const until = boostedUntil ? new Date(boostedUntil) : null;
  const daysLeft = until ? Math.max(0, Math.ceil((until.getTime() - Date.now()) / 86_400_000)) : 0;

  const apply = async () => {
    if (!tier) {
      setError("Pick a plan");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/advisor/posts/${postId}/boost`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();
      if (!res.ok || data.status === false) {
        setError(data.error || "Boost failed");
        setLoading(false);
        return;
      }
      setOpen(false);
      setTier(null);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <article className="card" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <FiTrendingUp size={18} color="#0ea5e9" />
        <h3 style={{ margin: 0 }}>Boost</h3>
        {active && (
          <span
            style={{
              marginLeft: "auto",
              padding: "2px 10px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              background: "#e0f2fe",
              color: "#0369a1",
            }}
          >
            Promoted · {daysLeft} day{daysLeft === 1 ? "" : "s"} left
          </span>
        )}
      </div>

      <p className="page-subtitle" style={{ margin: "6px 0 0" }}>
        Promote this post to the top of the feed. Choose a plan below.
      </p>

      {!approved ? (
        <p style={{ margin: "12px 0 0", fontSize: 13, color: "#92400e" }}>
          Only approved posts can be boosted.
        </p>
      ) : !open ? (
        <button
          type="button"
          className="btn-primary"
          style={{ marginTop: 12 }}
          onClick={() => setOpen(true)}
        >
          {active ? "Extend boost" : "Boost post"}
        </button>
      ) : (
        <div style={{ marginTop: 12 }}>
          <BoostPicker selected={tier} onSelect={setTier} includeNone={false} />
          <p style={{ margin: "8px 0 0", fontSize: 11, color: "#94a3b8" }}>
            No payment is taken — selecting a plan promotes the post immediately.
          </p>
          {error && <div style={{ marginTop: 10, fontSize: 13, color: "#b91c1c" }}>{error}</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
            <button
              type="button"
              className="input"
              style={{ width: "auto", padding: "10px 16px", cursor: "pointer" }}
              onClick={() => {
                setOpen(false);
                setTier(null);
                setError("");
              }}
              disabled={loading}
            >
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={apply} disabled={loading || !tier}>
              {loading ? "Boosting…" : "Confirm boost"}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
