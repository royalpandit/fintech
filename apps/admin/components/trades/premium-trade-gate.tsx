"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiLock, FiCheckCircle } from "react-icons/fi";
import { usePremiumPostUnlock } from "@/components/posts/use-premium-post-unlock";
import PremiumUnlockModal from "@/components/posts/premium-unlock-modal";
import SubscribePlansModal from "@/components/subscribe-plans-modal";
import TradePanel, { type TradePanelData } from "@/components/trades/trade-panel";
import { SUB_PLANS } from "@/lib/subscription-plans";
import { withGst } from "@/lib/trades";

// Trades — premium (paid / not-subscribed) trade detail gate.
// Shows an upside teaser, unlock/login, and an honest subscribe card. The actual
// entry/SL/target are NOT sent to the client until unlocked (see serializer).
// See TRADES-PHASE1-2-CHANGES.md.

const FEATURES = [
  "Entry, Target & Stop Loss",
  "Full Trade Analysis",
  "Charts & Attachments",
  "Updates & Trade Progress",
  "Comment & Discuss",
];

export default function PremiumTradeGate({
  postId,
  isAuthed,
  unlockPrice,
  teaser,
  precomputedReturnPct,
  advisor,
}: {
  postId: number;
  isAuthed: boolean;
  unlockPrice: number | null;
  teaser: TradePanelData;
  precomputedReturnPct: number | null;
  advisor: {
    id: number;
    fullName: string;
    subscriberCount: number;
    isSubscribed: boolean;
  };
}) {
  const router = useRouter();
  const [showPlans, setShowPlans] = useState(false);

  const premium = usePremiumPostUnlock({
    postId,
    kind: "market",
    initialLocked: true,
    initialUnlocked: false,
    isAuthed,
    onUnlocked: () => router.refresh(),
  });

  return (
    <>
      {/* Upside teaser */}
      <TradePanel data={teaser} locked hasTrade precomputedReturnPct={precomputedReturnPct} />

      {/* Premium message + unlock */}
      <article
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: 28,
          marginTop: 16,
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            margin: "0 auto 14px",
            display: "grid",
            placeItems: "center",
            background: "rgba(124,58,237,0.12)",
            color: "#7c3aed",
          }}
        >
          <FiLock size={24} />
        </div>
        <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: "var(--text)" }}>
          This is a premium trade post
        </h2>
        <p style={{ margin: "0 auto 18px", fontSize: 13, color: "var(--text-muted)", maxWidth: 420, lineHeight: 1.6 }}>
          Unlock to view entry, target, stop loss, full analysis and real-time updates.
        </p>

        <button
          type="button"
          onClick={premium.openUnlock}
          style={{
            width: "100%",
            maxWidth: 420,
            padding: "13px 18px",
            borderRadius: 12,
            border: "none",
            background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <FiLock size={15} /> Unlock This Post{unlockPrice ? ` — ₹${withGst(unlockPrice)}` : ""}
        </button>
        {unlockPrice ? (
          <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--text-muted)" }}>
            ₹{unlockPrice} + 18% GST = ₹{withGst(unlockPrice)}
          </p>
        ) : null}

        {!isAuthed && (
          <>
            <div style={{ margin: "16px auto", maxWidth: 420, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>OR</span>
              <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>
            <div
              style={{
                maxWidth: 420,
                margin: "0 auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "12px 14px",
                border: "1px solid var(--border)",
                borderRadius: 12,
              }}
            >
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Already a subscriber?</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Log in to view this post</div>
              </div>
              <button
                type="button"
                onClick={() => router.push("/login")}
                style={{
                  padding: "9px 18px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  color: "var(--text)",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Login
              </button>
            </div>
          </>
        )}

        {/* Feature checklist */}
        <div style={{ maxWidth: 420, margin: "20px auto 0", display: "grid", gap: 12, textAlign: "left" }}>
          {FEATURES.map((f) => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <FiCheckCircle size={16} style={{ color: "#7c3aed", flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: "var(--text)" }}>{f}</span>
            </div>
          ))}
        </div>
      </article>

      {/* Subscribe card (honest — real subscriber count, real plan price, no fabricated rating) */}
      <article
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: 22,
          marginTop: 16,
        }}
      >
        <h3 style={{ margin: "0 0 2px", fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
          Subscribe to {advisor.fullName}
        </h3>
        <p style={{ margin: "0 0 16px", fontSize: 12.5, color: "var(--text-muted)" }}>
          Get access to all premium trade posts.
        </p>

        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 120, padding: "12px 14px", background: "var(--surface-2)", borderRadius: 10 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>
              {advisor.subscriberCount.toLocaleString("en-IN")}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Subscribers</div>
          </div>
          <div style={{ flex: 1, minWidth: 120, padding: "12px 14px", background: "var(--surface-2)", borderRadius: 10 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>
              ₹{SUB_PLANS.monthly.price.toLocaleString("en-IN")}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>per month</div>
          </div>
        </div>

        {advisor.isSubscribed ? (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              background: "rgba(16,185,129,0.12)",
              color: "#047857",
              fontSize: 13,
              fontWeight: 700,
              textAlign: "center",
            }}
          >
            You&apos;re subscribed — unlocking should be free
          </div>
        ) : (
          <button
            type="button"
            onClick={() => (isAuthed ? setShowPlans(true) : router.push("/login"))}
            style={{
              width: "100%",
              padding: "13px 18px",
              borderRadius: 12,
              border: "none",
              background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            View Subscription Plans
            <span style={{ display: "block", fontSize: 11, fontWeight: 500, opacity: 0.85 }}>
              Starts from ₹{SUB_PLANS.monthly.price.toLocaleString("en-IN")}/month
            </span>
          </button>
        )}
      </article>

      <PremiumUnlockModal
        open={premium.modalOpen}
        onClose={() => premium.setModalOpen(false)}
        onUnlock={premium.confirmUnlock}
        loading={premium.loading}
      />

      {showPlans && (
        <SubscribePlansModal
          advisorId={advisor.id}
          title={`Subscribe to ${advisor.fullName}`}
          subtitle="Unlock all premium trade posts and 1-to-1 chat."
          onClose={() => setShowPlans(false)}
          onSubscribed={() => {
            setShowPlans(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
