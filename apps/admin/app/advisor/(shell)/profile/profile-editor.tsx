"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PROFESSIONAL_TYPES, type ProfessionalType } from "@/lib/professional-types";

type Initial = {
  fullName: string;
  bio: string;
  expertiseTags: string[];
  profileImageUrl: string;
  experienceYears: number;
  professionalType: ProfessionalType;
};

const SUGGESTED_TAGS = [
  "Equity",
  "Derivatives",
  "Mutual Funds",
  "Commodities",
  "Crypto",
  "Tax Planning",
  "Retirement",
  "Estate Planning",
  "Small Cap",
  "Large Cap",
  "Mid Cap",
  "Technical Analysis",
  "Fundamental",
  "Long Term",
  "Short Term",
];

export default function ProfileEditor({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initial.fullName);
  const [bio, setBio] = useState(initial.bio);
  const [tags, setTags] = useState<string[]>(initial.expertiseTags);
  const [newTag, setNewTag] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState(initial.profileImageUrl);
  const [experienceYears, setExperienceYears] = useState(String(initial.experienceYears));
  const [professionalType, setProfessionalType] = useState<ProfessionalType>(initial.professionalType);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const uploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "image");
      const res = await fetch("/api/v1/uploads/social", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || data.status === false) {
        setError(data.error || "Image upload failed");
        return;
      }
      setProfileImageUrl(data.url);
    } catch {
      setError("Image upload failed");
    } finally {
      setUploadingImage(false);
    }
  };

  const addTag = (value: string) => {
    const t = value.trim();
    if (!t) return;
    if (tags.includes(t)) return;
    if (tags.length >= 10) return;
    setTags([...tags, t]);
    setNewTag("");
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await fetch("/api/v1/advisor/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          bio: bio.trim(),
          expertiseTags: tags,
          profileImageUrl: profileImageUrl.trim() || null,
          experienceYears: Number(experienceYears) || 0,
          professionalType,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.status === false) {
        setError(data.error || "Save failed");
        setLoading(false);
        return;
      }
      setSuccess("Profile saved.");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <article className="card">
      <h3 style={{ marginTop: 0 }}>Public Profile</h3>
      <p className="page-subtitle" style={{ marginTop: 0 }}>
        This is what users see when they visit your advisor page.
      </p>

      <form onSubmit={submit}>
        <label className="metric-label">Profile Image</label>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              flexShrink: 0,
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
              backgroundImage: profileImageUrl ? `url(${profileImageUrl})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
              display: "grid",
              placeItems: "center",
              color: "var(--text-muted)",
              fontSize: 11,
              overflow: "hidden",
            }}
          >
            {!profileImageUrl && "No image"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label
              className="input"
              style={{
                width: "auto",
                padding: "8px 14px",
                cursor: uploadingImage ? "wait" : "pointer",
                textAlign: "center",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {uploadingImage ? "Uploading…" : profileImageUrl ? "Change image" : "Upload image"}
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                hidden
                disabled={uploadingImage}
                onChange={uploadImage}
              />
            </label>
            {profileImageUrl && (
              <button
                type="button"
                onClick={() => setProfileImageUrl("")}
                style={{
                  background: "none",
                  border: "none",
                  color: "#dc2626",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: 0,
                  textAlign: "left",
                }}
              >
                Remove
              </button>
            )}
          </div>
        </div>

        <label className="metric-label">Display Name</label>
        <input
          className="input"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          minLength={2}
        />

        <label className="metric-label" style={{ marginTop: 16 }}>
          Professional Type
        </label>
        <select
          className="input"
          value={professionalType}
          onChange={(e) => setProfessionalType(e.target.value as ProfessionalType)}
        >
          {PROFESSIONAL_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--text-muted)" }}>
          How you appear when users filter finance professionals.
        </p>

        <label className="metric-label" style={{ marginTop: 16 }}>
          Bio
        </label>
        <textarea
          className="input"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={5}
          placeholder="Your advisory focus, strategy, and credentials."
          style={{ resize: "vertical" }}
        />

        <label className="metric-label" style={{ marginTop: 16 }}>
          Expertise Tags ({tags.length}/10)
        </label>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            padding: 10,
            border: "1px solid var(--border)",
            borderRadius: 10,
            minHeight: 48,
          }}
        >
          {tags.map((tag) => (
            <span
              key={tag}
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                background: "#d1fae5",
                color: "#047857",
                fontSize: 12,
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#047857",
                  cursor: "pointer",
                  fontSize: 14,
                  padding: 0,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </span>
          ))}
          <input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag(newTag);
              }
            }}
            placeholder={tags.length < 10 ? "Type and press Enter..." : "Max reached"}
            disabled={tags.length >= 10}
            style={{
              flex: 1,
              minWidth: 140,
              border: "none",
              outline: "none",
              fontSize: 13,
            }}
          />
        </div>

        <div style={{ marginTop: 8 }}>
          <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Suggested:</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {SUGGESTED_TAGS.filter((t) => !tags.includes(t))
              .slice(0, 10)
              .map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => addTag(tag)}
                  style={{
                    padding: "3px 8px",
                    borderRadius: 999,
                    background: "var(--surface-2)",
                    border: "1px dashed var(--border)",
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  + {tag}
                </button>
              ))}
          </div>
        </div>

        <label className="metric-label" style={{ marginTop: 16 }}>
          Years of Experience
        </label>
        <input
          className="input"
          type="number"
          min={0}
          max={60}
          value={experienceYears}
          onChange={(e) => setExperienceYears(e.target.value)}
        />

        {error && (
          <div
            style={{
              marginTop: 16,
              padding: "10px 12px",
              background: "rgba(239,68,68,0.12)",
              color: "#b91c1c",
              borderRadius: 10,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}
        {success && (
          <div
            style={{
              marginTop: 16,
              padding: "10px 12px",
              background: "rgba(34,197,94,0.12)",
              color: "#047857",
              borderRadius: 10,
              fontSize: 14,
            }}
          >
            {success}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </form>
    </article>
  );
}
