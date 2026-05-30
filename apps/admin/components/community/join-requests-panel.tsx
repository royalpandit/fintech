"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchJoinRequests, reviewJoinRequest } from "@/lib/community-client";
import { UserPageBackLink } from "@/components/user/user-page-layout";
import { formatRelativeTime } from "@/lib/format-date";

export default function JoinRequestsPanel({ slug, communityName }: { slug: string; communityName: string }) {
  const [requests, setRequests] = useState<
    { id: number; status: string; created_at: string; user: { id: number; fullName: string; email: string } }[]
  >([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchJoinRequests(slug);
      setRequests(data.requests);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [slug]);

  async function review(userId: number, action: "approve" | "reject") {
    await reviewJoinRequest(slug, userId, action);
    await load();
  }

  return (
    <div className="comm-panel">
      <UserPageBackLink href={`/user/community/${slug}`}>← Back to {communityName}</UserPageBackLink>
      <h1 className="comm-form-title">Join Requests</h1>
      {loading ? (
        <p className="comm-loading">Loading...</p>
      ) : requests.length === 0 ? (
        <div className="comm-empty"><p>No pending requests.</p></div>
      ) : (
        <div className="comm-request-list">
          {requests.map((r) => (
            <div key={r.id} className="comm-request-row">
              <div>
                <strong>{r.user.fullName}</strong>
                <p className="comm-request-email">{r.user.email}</p>
                <span className="comm-request-date">{formatRelativeTime(r.created_at)}</span>
              </div>
              <div className="comm-request-actions">
                <button type="button" className="comm-btn comm-btn-primary comm-btn-sm" onClick={() => void review(r.user.id, "approve")}>
                  Approve
                </button>
                <button type="button" className="comm-btn comm-btn-danger comm-btn-sm" onClick={() => void review(r.user.id, "reject")}>
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
