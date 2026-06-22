"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCommunityPost, uploadSocialFile } from "@/lib/community-client";
import { UserPageBackLink } from "@/components/user/user-page-layout";

export default function CreateCommunityPostForm({
  slug,
  communityName,
}: {
  slug: string;
  communityName: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [postType, setPostType] = useState<"text" | "image" | "video" | "link">("text");
  const [linkUrl, setLinkUrl] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      urls.push(await uploadSocialFile(file, "image"));
    }
    setImageUrls((prev) => [...prev, ...urls]);
    setPostType("image");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return; // guard against double-submit
    setLoading(true);
    setError("");
    try {
      const { post } = await createCommunityPost(slug, {
        title: title || undefined,
        content,
        postType,
        imageUrls: imageUrls.length ? imageUrls : undefined,
        linkUrl: postType === "link" ? linkUrl : undefined,
      });
      // Keep the button disabled while we navigate away — do NOT re-enable on
      // success, otherwise a quick second click posts twice.
      router.push(`/user/community/${slug}/post/${post.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create post");
      setLoading(false);
    }
  }

  return (
    <div className="comm-form-wrap">
      <UserPageBackLink href={`/user/community/${slug}`}>← Back to {communityName}</UserPageBackLink>
      <h1 className="comm-form-title">Create Post</h1>
      <form className="comm-form" onSubmit={onSubmit}>
        <label>
          Post Type
          <select value={postType} onChange={(e) => setPostType(e.target.value as typeof postType)}>
            <option value="text">Text</option>
            <option value="image">Image</option>
            <option value="video">Video</option>
            <option value="link">Link</option>
          </select>
        </label>
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          Content *
          <textarea value={content} onChange={(e) => setContent(e.target.value)} required rows={5} />
        </label>
        {postType === "link" && (
          <label>
            Link URL
            <input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} required />
          </label>
        )}
        {postType === "image" && (
          <label>
            Images
            <input type="file" accept="image/*" multiple onChange={(e) => void onImageUpload(e)} />
            <div className="comm-image-previews">
              {imageUrls.map((url) => (
                <img key={url} src={url} alt="" className="comm-preview-img" />
              ))}
            </div>
          </label>
        )}
        {error ? <p className="comm-error">{error}</p> : null}
        <button type="submit" className="comm-btn comm-btn-primary" disabled={loading}>
          {loading ? "Posting..." : "Publish Post"}
        </button>
      </form>
    </div>
  );
}
