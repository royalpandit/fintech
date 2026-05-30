"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateCommunity, uploadSocialFile } from "@/lib/community-client";
import type { SerializedCommunity } from "@/lib/community";
import { UserPageBackLink } from "@/components/user/user-page-layout";

type PostPermissionLevel = SerializedCommunity["post_permission"];

const POST_PERMISSION_OPTIONS: { value: PostPermissionLevel; label: string; description: string }[] = [
  {
    value: "everyone",
    label: "Everyone",
    description: "All approved members can create posts",
  },
  {
    value: "admins",
    label: "Only Admins & Moderators",
    description: "Owner, admins, and moderators can create posts",
  },
  {
    value: "owner",
    label: "Only Community Owner",
    description: "Only the owner can create posts",
  },
];

export default function CommunitySettingsForm({
  initialCommunity,
}: {
  initialCommunity: SerializedCommunity;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialCommunity.name);
  const [description, setDescription] = useState(initialCommunity.description ?? "");
  const [rules, setRules] = useState(initialCommunity.rules ?? "");
  const [communityType, setCommunityType] = useState(initialCommunity.community_type);
  const [postPermission, setPostPermission] = useState(initialCommunity.post_permission);
  const [logoUrl, setLogoUrl] = useState(initialCommunity.logo_url ?? "");
  const [bannerUrl, setBannerUrl] = useState(initialCommunity.banner_url ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>, kind: "logo" | "banner") {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadSocialFile(file, "image");
    if (kind === "logo") setLogoUrl(url);
    else setBannerUrl(url);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { community } = await updateCommunity(initialCommunity.slug, {
        name,
        description,
        rules,
        communityType,
        postPermission,
        logoUrl: logoUrl || undefined,
        bannerUrl: bannerUrl || undefined,
      });
      router.push(`/user/community/${community.slug}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="comm-form-wrap">
      <UserPageBackLink href={`/user/community/${initialCommunity.slug}`}>
        ← Back to {initialCommunity.name}
      </UserPageBackLink>
      <h1 className="comm-form-title">Community Settings</h1>
      <form className="comm-form" onSubmit={onSubmit}>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} disabled={initialCommunity.my_role !== "owner"} />
        </label>
        <label>
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </label>
        <label>
          Rules
          <textarea value={rules} onChange={(e) => setRules(e.target.value)} rows={4} />
        </label>
        {initialCommunity.my_role === "owner" && (
          <label>
            Visibility
            <select value={communityType} onChange={(e) => setCommunityType(e.target.value as "public" | "private")}>
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </label>
        )}

        <label>
          Posting Permissions
          <select
            value={postPermission}
            onChange={(e) => setPostPermission(e.target.value as PostPermissionLevel)}
          >
            {POST_PERMISSION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="comm-field-hint">
            {POST_PERMISSION_OPTIONS.find((o) => o.value === postPermission)?.description}
          </span>
        </label>

        <label>
          Logo
          <input type="file" accept="image/*" onChange={(e) => void onUpload(e, "logo")} />
        </label>
        <label>
          Banner
          <input type="file" accept="image/*" onChange={(e) => void onUpload(e, "banner")} />
        </label>
        {error ? <p className="comm-error">{error}</p> : null}
        <button type="submit" className="comm-btn comm-btn-primary" disabled={loading}>
          {loading ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
