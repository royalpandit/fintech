"use client";

import Link from "next/link";
import type { SerializedCommunity } from "@/lib/community";
import { FiGlobe, FiLock, FiUsers } from "react-icons/fi";

export default function CommunityCard({ community }: { community: SerializedCommunity }) {
  const isPrivate = community.community_type === "private";

  return (
    <Link href={`/user/community/${community.slug}`} className="comm-card">
      <div
        className="comm-card-banner"
        style={
          community.banner_url
            ? { backgroundImage: `url(${community.banner_url})` }
            : undefined
        }
      />
      <div className="comm-card-body">
        <div className="comm-card-header">
          {community.logo_url ? (
            <img src={community.logo_url} alt="" className="comm-card-logo" />
          ) : (
            <div className="comm-card-logo comm-card-logo-fallback">
              {community.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="comm-card-meta">
            <h3 className="comm-card-name">{community.name}</h3>
            <span className={`comm-badge ${isPrivate ? "comm-badge-private" : "comm-badge-public"}`}>
              {isPrivate ? <FiLock size={10} /> : <FiGlobe size={10} />}
              {isPrivate ? "Private" : "Public"}
            </span>
          </div>
        </div>
        {community.description ? (
          <p className="comm-card-desc">{community.description.slice(0, 120)}</p>
        ) : null}
        <div className="comm-card-stats">
          <span><FiUsers size={12} /> {community.member_count.toLocaleString()} members</span>
          <span>{community.post_count.toLocaleString()} posts</span>
        </div>
        {community.my_join_status === "member" ? (
          <span className="comm-joined-pill">Joined</span>
        ) : community.my_join_status === "pending" ? (
          <span className="comm-pending-pill">Request pending</span>
        ) : null}
      </div>
    </Link>
  );
}
