"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FiGlobe,
  FiHeart,
  FiLock,
  FiMessageSquare,
  FiShare2,
  FiUsers,
  FiSettings,
  FiPlus,
} from "react-icons/fi";
import type { SerializedCommunity } from "@/lib/community";
import {
  fetchCommunity,
  fetchCommunityPosts,
  joinCommunity,
  leaveCommunity,
  likeCommunityPost,
  shareCommunityPost,
  type CommunitySort,
} from "@/lib/community-client";
import type { SocialPost } from "@/lib/social-feed-types";
import { formatRelativeTime } from "@/lib/format-date";
import CommunityPostImages from "@/components/community/community-post-images";

const SORTS: { id: CommunitySort; label: string }[] = [
  { id: "latest", label: "Latest" },
  { id: "liked", label: "Most Liked" },
  { id: "commented", label: "Most Commented" },
  { id: "trending", label: "Trending" },
];

function PostRow({
  post,
  slug,
  isAuthed,
  canInteract,
}: {
  post: SocialPost;
  slug: string;
  isAuthed: boolean;
  canInteract: boolean;
}) {
  const [p, setP] = useState(post);

  async function toggleLike() {
    if (!canInteract) return;
    const data = await likeCommunityPost(slug, p.id);
    setP((prev) => ({
      ...prev,
      liked_by_me: data.liked,
      like_count: data.like_count,
    }));
  }

  async function onShare() {
    if (!canInteract) return;
    const data = await shareCommunityPost(slug, p.id);
    setP((prev) => ({ ...prev, share_count: data.share_count }));
  }

  return (
    <article className="comm-post-row">
      <Link href={`/user/community/${slug}/post/${p.id}`} className="comm-post-row-main">
        <div className="comm-post-votes">
          <button
            type="button"
            className={`comm-vote-btn ${p.liked_by_me ? "comm-vote-active" : ""}`}
            onClick={(e) => {
              e.preventDefault();
              void toggleLike();
            }}
            disabled={!isAuthed || !canInteract}
          >
            <FiHeart size={16} />
          </button>
          <span>{p.like_count}</span>
        </div>
        <div className="comm-post-content">
          <div className="comm-post-meta">
            <span>{p.user.fullName}</span>
            <span>·</span>
            <span>{formatRelativeTime(p.created_at)}</span>
          </div>
          {p.title ? <h3 className="comm-post-title">{p.title}</h3> : null}
          <p className="comm-post-excerpt">{p.content.slice(0, 280)}</p>
          {p.images?.length ? (
            <CommunityPostImages images={p.images.map((i) => ({ id: i.id, url: i.url }))} />
          ) : null}
          <div className="comm-post-stats">
            <span><FiMessageSquare size={12} /> {p.comment_count}</span>
            <button
              type="button"
              className="comm-inline-btn"
              onClick={(e) => {
                e.preventDefault();
                void onShare();
              }}
              disabled={!isAuthed || !canInteract}
            >
              <FiShare2 size={12} /> Share
            </button>
          </div>
        </div>
      </Link>
    </article>
  );
}

export default function CommunityDetailClient({
  initialCommunity,
  isAuthed,
}: {
  initialCommunity: SerializedCommunity;
  isAuthed: boolean;
}) {
  const router = useRouter();
  const [community, setCommunity] = useState(initialCommunity);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [sort, setSort] = useState<CommunitySort>("latest");
  const [loading, setLoading] = useState(true);
  const [joinLoading, setJoinLoading] = useState(false);

  useEffect(() => {
    setCommunity(initialCommunity);
  }, [initialCommunity]);

  useEffect(() => {
    if (!isAuthed) return;
    void fetchCommunity(initialCommunity.slug)
      .then(({ community }) => setCommunity(community))
      .catch(() => {});
  }, [initialCommunity.slug, isAuthed]);

  const loadPosts = useCallback(async () => {
    if (!community.can_view_posts) {
      setPosts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchCommunityPosts(community.slug, { sort });
      setPosts(data.posts);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [community.slug, community.can_view_posts, sort]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  async function onJoin() {
    setJoinLoading(true);
    try {
      const data = await joinCommunity(community.slug);
      if (data.community) setCommunity(data.community);
      else router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to join");
    } finally {
      setJoinLoading(false);
    }
  }

  async function onLeave() {
    if (!confirm("Leave this community?")) return;
    await leaveCommunity(community.slug);
    router.refresh();
  }

  const isMember = community.my_join_status === "member";
  const isPending = community.my_join_status === "pending";
  const isPrivate = community.community_type === "private";
  const isAdmin = community.my_role === "owner" || community.my_role === "admin";

  return (
    <div className="comm-detail">
      <div
        className="comm-detail-banner"
        style={
          community.banner_url
            ? { backgroundImage: `url(${community.banner_url})` }
            : undefined
        }
      />
      <div className="comm-detail-header">
        {community.logo_url ? (
          <img src={community.logo_url} alt="" className="comm-detail-logo" />
        ) : (
          <div className="comm-detail-logo comm-card-logo-fallback">
            {community.name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="comm-detail-info">
          <h1>{community.name}</h1>
          <div className="comm-detail-badges">
            <span className={`comm-badge ${isPrivate ? "comm-badge-private" : "comm-badge-public"}`}>
              {isPrivate ? <FiLock size={10} /> : <FiGlobe size={10} />}
              {isPrivate ? "Private" : "Public"}
            </span>
            <span className="comm-detail-stat"><FiUsers size={12} /> {community.member_count} members</span>
            <span className="comm-detail-stat">{community.post_count} posts</span>
          </div>
        </div>
        <div className="comm-detail-actions">
          {isAuthed && !isMember && !isPending && (
            <button type="button" className="comm-btn comm-btn-primary" onClick={() => void onJoin()} disabled={joinLoading}>
              {isPrivate ? "Request to Join" : "Join"}
            </button>
          )}
          {isPending && <span className="comm-pending-pill">Request Pending</span>}
          {isMember && community.my_role !== "owner" && (
            <button type="button" className="comm-btn comm-btn-ghost" onClick={() => void onLeave()}>
              Leave
            </button>
          )}
          {isMember && community.can_create_post && (
            <Link href={`/user/community/${community.slug}/new`} className="comm-btn comm-btn-primary">
              <FiPlus size={14} /> Create Post
            </Link>
          )}
          <Link href={`/user/community/${community.slug}/members`} className="comm-btn comm-btn-ghost">
            <FiUsers size={14} /> Members
          </Link>
          {isAdmin && (
            <>
              <Link href={`/user/community/${community.slug}/requests`} className="comm-btn comm-btn-ghost">
                Requests
              </Link>
              <Link href={`/user/community/${community.slug}/settings`} className="comm-btn comm-btn-ghost">
                <FiSettings size={14} />
              </Link>
            </>
          )}
        </div>
      </div>

      {community.description ? <p className="comm-detail-desc">{community.description}</p> : null}

      {isMember && !community.can_create_post && community.post_permission !== "everyone" && community.post_permission_hint ? (
        <div className="comm-permission-notice">
          <strong>Posting restricted</strong>
          <p>{community.post_permission_hint}</p>
        </div>
      ) : null}

      {!community.can_view_posts && (
        <div className="comm-locked-notice">
          <FiLock size={20} />
          <div>
            <strong>Private community</strong>
            <p>Join and get approved to view posts and participate.</p>
          </div>
        </div>
      )}

      {community.can_view_posts && (
        <>
          <div className="comm-filters">
            {SORTS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`comm-filter ${sort === s.id ? "comm-filter-active" : ""}`}
                onClick={() => setSort(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="comm-post-list">
            {loading ? (
              <p className="comm-loading">Loading posts...</p>
            ) : posts.length === 0 ? (
              <div className="comm-empty">
                <p>No posts yet.</p>
                {isMember && community.can_create_post ? (
                  <Link href={`/user/community/${community.slug}/new`}>Create the first post</Link>
                ) : null}
              </div>
            ) : (
              posts.map((p) => (
                <PostRow
                  key={p.id}
                  post={p}
                  slug={community.slug}
                  isAuthed={isAuthed}
                  canInteract={community.can_interact}
                />
              ))
            )}
          </div>
        </>
      )}

      {community.rules && (
        <aside className="comm-rules-panel">
          <h3>Community Rules</h3>
          <pre>{community.rules}</pre>
        </aside>
      )}
    </div>
  );
}
