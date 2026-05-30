"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCommunity, uploadSocialFile } from "@/lib/community-client";
import { UserPageBackLink } from "@/components/user/user-page-layout";

export default function CreateCommunityForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [communityType, setCommunityType] = useState<"public" | "private">("public");
  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>, kind: "logo" | "banner") {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadSocialFile(file, "image");
      if (kind === "logo") setLogoUrl(url);
      else setBannerUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { community } = await createCommunity({
        name,
        description,
        rules,
        communityType,
        logoUrl: logoUrl || undefined,
        bannerUrl: bannerUrl || undefined,
      });
      router.push(`/user/community/${community.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create community");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="comm-form-wrap">
      <UserPageBackLink href="/user/community">← Back to Communities</UserPageBackLink>
      <h1 className="comm-form-title">Create a Community</h1>
      <form className="comm-form" onSubmit={onSubmit}>
        <label>
          Community Name *
          <input value={name} onChange={(e) => setName(e.target.value)} required minLength={3} />
        </label>
        <label>
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </label>
        <label>
          Community Rules
          <textarea value={rules} onChange={(e) => setRules(e.target.value)} rows={4} placeholder="One rule per line" />
        </label>
        <label>
          Type
          <select value={communityType} onChange={(e) => setCommunityType(e.target.value as "public" | "private")}>
            <option value="public">Public — anyone can join instantly</option>
            <option value="private">Private — join requests require approval</option>
          </select>
        </label>
        <label>
          Logo
          <input type="file" accept="image/*" onChange={(e) => void onUpload(e, "logo")} />
          {logoUrl ? <img src={logoUrl} alt="" className="comm-preview-img" /> : null}
        </label>
        <label>
          Banner
          <input type="file" accept="image/*" onChange={(e) => void onUpload(e, "banner")} />
          {bannerUrl ? <img src={bannerUrl} alt="" className="comm-preview-banner" /> : null}
        </label>
        {error ? <p className="comm-error">{error}</p> : null}
        <button type="submit" className="comm-btn comm-btn-primary" disabled={loading}>
          {loading ? "Creating..." : "Create Community"}
        </button>
      </form>
    </div>
  );
}
