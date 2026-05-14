"use client";

import { useState } from "react";
import { FiUserPlus, FiUserCheck } from "react-icons/fi";

type Props = {
  advisorId: number;
  initialFollowing: boolean;
  size?: "sm" | "md" | "lg";
};

export default function FollowToggle({ advisorId, initialFollowing, size = "md" }: Props) {
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (loading) return;
    setLoading(true);
    const prev = following;
    setFollowing(!prev);
    try {
      const url = prev
        ? `/api/v1/community/unfollow/${advisorId}`
        : `/api/v1/community/follow/${advisorId}`;
      const res = await fetch(url, { method: prev ? "DELETE" : "POST" });
      if (!res.ok) setFollowing(prev);
    } catch {
      setFollowing(prev);
    } finally {
      setLoading(false);
    }
  }

  const pad = size === "sm" ? "5px 12px" : size === "lg" ? "12px 24px" : "8px 18px";
  const fontSize = size === "sm" ? 11 : size === "lg" ? 15 : 13;
  const iconSize = size === "sm" ? 11 : size === "lg" ? 16 : 13;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: pad,
        borderRadius: 10,
        border: following ? "1px solid #e2e8f0" : "1px solid #0ea5e9",
        background: following ? "#f8fafc" : "rgba(14,165,233,0.1)",
        color: following ? "#64748b" : "#0ea5e9",
        fontSize,
        fontWeight: 700,
        cursor: loading ? "wait" : "pointer",
        transition: "all 0.15s",
        opacity: loading ? 0.7 : 1,
      }}
    >
      {following ? <FiUserCheck size={iconSize} /> : <FiUserPlus size={iconSize} />}
      {following ? "Following" : "Follow"}
    </button>
  );
}
