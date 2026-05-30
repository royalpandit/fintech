"use client";

import { useEffect, useState } from "react";
import { fetchMembers } from "@/lib/community-client";
import { UserPageBackLink } from "@/components/user/user-page-layout";
import { formatRelativeTime } from "@/lib/format-date";

const ROLE_COLORS: Record<string, string> = {
  owner: "#7c3aed",
  admin: "#0ea5e9",
  moderator: "#10b981",
  member: "#64748b",
};

export default function MembersPanel({
  slug,
  communityName,
  myRole,
}: {
  slug: string;
  communityName: string;
  myRole: string | null;
}) {
  const [members, setMembers] = useState<
    { user_id: number; role: string; joined_at: string; user: { fullName: string }; is_me: boolean }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchMembers(slug).then((d) => {
      setMembers(d.members);
      setLoading(false);
    });
  }, [slug]);

  return (
    <div className="comm-panel">
      <UserPageBackLink href={`/user/community/${slug}`}>← Back to {communityName}</UserPageBackLink>
      <h1 className="comm-form-title">Members</h1>
      {loading ? (
        <p className="comm-loading">Loading...</p>
      ) : (
        <div className="comm-member-list">
          {members.map((m) => (
            <div key={m.user_id} className="comm-member-row">
              <div className="comm-member-avatar">{m.user.fullName.slice(0, 2).toUpperCase()}</div>
              <div className="comm-member-info">
                <strong>{m.user.fullName}{m.is_me ? " (you)" : ""}</strong>
                <span>Joined {formatRelativeTime(m.joined_at)}</span>
              </div>
              <span className="comm-role-badge" style={{ color: ROLE_COLORS[m.role] ?? "#64748b" }}>
                {m.role}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
