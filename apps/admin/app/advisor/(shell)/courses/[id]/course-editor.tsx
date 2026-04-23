"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Initial = {
  title: string;
  description: string;
  price: string;
  coverImageUrl: string;
  isPublished: boolean;
  complianceStatus: string;
};

function statusTag(status: string) {
  const colors: Record<string, { bg: string; fg: string }> = {
    approved: { bg: "#d1fae5", fg: "#047857" },
    pending: { bg: "#fef3c7", fg: "#92400e" },
    flagged: { bg: "#fee2e2", fg: "#991b1b" },
    rejected: { bg: "#fee2e2", fg: "#991b1b" },
    under_review: { bg: "#fef3c7", fg: "#92400e" },
  };
  const s = colors[status] ?? colors.pending;
  return (
    <span
      style={{
        padding: "4px 12px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: s.bg,
        color: s.fg,
        textTransform: "uppercase",
        letterSpacing: 0.5,
      }}
    >
      {status}
    </span>
  );
}

export default function CourseEditor({ courseId, initial }: { courseId: number; initial: Initial }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [price, setPrice] = useState(initial.price);
  const [coverImageUrl, setCoverImageUrl] = useState(initial.coverImageUrl);
  const [isPublished, setIsPublished] = useState(initial.isPublished);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const approved = initial.complianceStatus === "approved";

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await fetch(`/api/v1/advisor/courses/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          price: Number(price || 0),
          coverImageUrl: coverImageUrl.trim() || null,
          isPublished,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.status === false) {
        setError(data.error || "Save failed");
        setLoading(false);
        return;
      }
      setSuccess("Saved.");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async () => {
    if (!confirm("Delete this course? Students who already enrolled keep access.")) return;
    setDeleting(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/advisor/courses/${courseId}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok || data.status === false) {
        setError(data.error || "Delete failed");
        setDeleting(false);
        return;
      }
      router.push("/advisor/courses");
      router.refresh();
    } catch {
      setError("Network error");
      setDeleting(false);
    }
  };

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 12,
          marginTop: 8,
        }}
      >
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>
            Edit Course
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {statusTag(initial.complianceStatus)}
            {isPublished ? (
              <span style={{ fontSize: 12, color: "#047857", fontWeight: 600 }}>🌐 Live</span>
            ) : (
              <span style={{ fontSize: 12, color: "#61708b" }}>📝 Draft</span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          style={{
            padding: "10px 16px",
            borderRadius: 10,
            border: "1px solid #fecaca",
            background: "#fff",
            color: "#dc2626",
            fontWeight: 600,
            cursor: deleting ? "not-allowed" : "pointer",
          }}
        >
          {deleting ? "Deleting..." : "Delete"}
        </button>
      </div>

      <form onSubmit={save}>
        <article className="card" style={{ marginTop: 16 }}>
          <div className="grid" style={{ gridTemplateColumns: "2fr 1fr", gap: 16 }}>
            <div>
              <label className="metric-label">Title</label>
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                minLength={5}
                required
              />

              <label className="metric-label" style={{ marginTop: 12 }}>
                Description
              </label>
              <textarea
                className="input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                minLength={20}
                required
                style={{ resize: "vertical" }}
              />

              <div className="grid" style={{ gridTemplateColumns: "1fr 2fr", gap: 12, marginTop: 12 }}>
                <div>
                  <label className="metric-label">Price (₹)</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="metric-label">Cover Image URL</label>
                  <input
                    className="input"
                    type="url"
                    value={coverImageUrl}
                    onChange={(e) => setCoverImageUrl(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="metric-label">Publishing</label>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: 12,
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  cursor: approved ? "pointer" : "not-allowed",
                  opacity: approved ? 1 : 0.6,
                }}
              >
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  disabled={!approved}
                />
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>Publish live</p>
                  <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
                    {approved ? "Accept new enrollments" : "Available after admin approval"}
                  </p>
                </div>
              </label>

              {!approved && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 10,
                    background: "#fffbeb",
                    border: "1px solid #fde68a",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "#713f12",
                  }}
                >
                  This course is pending admin review. You'll be able to publish once approved.
                </div>
              )}
            </div>
          </div>

          {error && (
            <div
              style={{
                marginTop: 16,
                padding: "10px 12px",
                background: "#fef2f2",
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
                background: "#f0fdf4",
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
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </article>
      </form>
    </>
  );
}
