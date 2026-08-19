"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FiArrowLeft,
  FiGlobe,
  FiHeart,
  FiLock,
  FiMessageSquare,
  FiShare2,
  FiUsers,
  FiSettings,
  FiPlus,
  FiX,
} from "react-icons/fi";
import CreateCommunityPostForm from "@/components/community/create-community-post-form";
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
import { useToast } from "@/components/toast";

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
  const toast = useToast();

  // Both of these were fire-and-forget, so a 403 or network error left the row
  // completely unchanged with nothing explaining why.
  async function toggleLike() {
    if (!canInteract) return;
    try {
      const data = await likeCommunityPost(slug, p.id);
      setP((prev) => ({
        ...prev,
        liked_by_me: data.liked,
        like_count: data.like_count,
      }));
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Couldn't update your like", "error");
    }
  }

  async function onShare() {
    if (!canInteract) return;
    const url = `${window.location.origin}/user/community/${slug}/post/${p.id}`;
    try {
      const data = await shareCommunityPost(slug, p.id);
      setP((prev) => ({ ...prev, share_count: data.share_count }));

      if (typeof navigator.share === "function") {
        try {
          await navigator.share({ title: p.title ?? "Community post", url });
          return;
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return;
        }
      }
      await navigator.clipboard?.writeText(url);
      toast.show("Link copied", "success");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Couldn't share this post", "error");
    }
  }

  return (
    <article className="comm-post-row">
      <Link href={`/user/community/${slug}/post/${p.id}`} className="comm-post-row-main">
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
            <button
              type="button"
              className={`comm-inline-btn ${p.liked_by_me ? "comm-vote-active" : ""}`}
              onClick={(e) => {
                e.preventDefault();
                void toggleLike();
              }}
              disabled={!isAuthed || !canInteract}
              title={isAuthed && !canInteract ? "Join this community to like posts" : undefined}
            >
              <FiHeart size={15} /> {p.like_count}
            </button>
            <span><FiMessageSquare size={15} /> {p.comment_count}</span>
            <button
              type="button"
              className="comm-inline-btn"
              onClick={(e) => {
                e.preventDefault();
                void onShare();
              }}
              disabled={!isAuthed || !canInteract}
              title={isAuthed && !canInteract ? "Join this community to share posts" : undefined}
            >
              <FiShare2 size={15} /> Share
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
  // Create Post opens over the community page instead of navigating away.
  const [createOpen, setCreateOpen] = useState(false);

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
      {/* Always return to the communities list. `router.back()` followed browser
          history, so arriving from a post detail (or a deep link / refresh) sent
          the user somewhere unrelated — or nowhere at all. */}
      <Link
        href="/user/community"
        className="user-page-back-link"
        style={{ marginBottom: 12 }}
      >
        <span className="user-page-back-icon">
          <FiArrowLeft size={14} />
        </span>
        All communities
      </Link>
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
            <button
              type="button"
              className="comm-btn comm-btn-primary"
              onClick={() => setCreateOpen(true)}
            >
              <FiPlus size={14} /> Create Post
            </button>
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
                  <button
                    type="button"
                    className="comm-linklike"
                    onClick={() => setCreateOpen(true)}
                  >
                    Create the first post
                  </button>
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

      {/* Create Post — rendered over the community page, which stays visible
          (blurred) behind the modal. */}
      {createOpen && (
        <div
          className="comm-modal-overlay"
          role="dialog"
          aria-label="Create post"
          onClick={() => setCreateOpen(false)}
        >
          <div className="comm-modal" onClick={(e) => e.stopPropagation()}>
            <header className="comm-modal-head">
              <h2>Create Post</h2>
              <button
                type="button"
                className="comm-modal-close"
                onClick={() => setCreateOpen(false)}
                aria-label="Close"
              >
                <FiX size={18} />
              </button>
            </header>
            <div className="comm-modal-body">
              <CreateCommunityPostForm
                slug={community.slug}
                communityName={community.name}
                onCreated={() => {
                  setCreateOpen(false);
                  void loadPosts();
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
