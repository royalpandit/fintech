"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewCoursePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/v1/advisor/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          price: Number(price || 0),
          coverImageUrl: coverImageUrl.trim() || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.status === false) {
        setError(data.error || "Failed to create course");
        setLoading(false);
        return;
      }
      router.push(`/advisor/courses/${data.course.id}`);
      router.refresh();
    } catch {
      setError("Network error");
      setLoading(false);
    }
  };

  return (
    <section>
      <Link href="/advisor/courses" className="page-subtitle" style={{ marginTop: 0, display: "inline-block" }}>
        ← My Courses
      </Link>
      <h1 className="page-title">Create Course</h1>
      <p className="page-subtitle">
        Courses go to admin review. Once approved, you can publish and accept enrollments.
      </p>

      <form onSubmit={submit}>
        <div className="grid" style={{ gridTemplateColumns: "2fr 1fr", marginTop: 16, alignItems: "start" }}>
          <article className="card">
            <label className="metric-label">Title *</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Options Trading Fundamentals"
              required
              minLength={5}
            />

            <label className="metric-label" style={{ marginTop: 16 }}>
              Description *
            </label>
            <textarea
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              required
              minLength={20}
              placeholder="What will students learn? Be specific about outcomes."
              style={{ resize: "vertical" }}
            />

            <div className="grid" style={{ gridTemplateColumns: "1fr 2fr", gap: 12, marginTop: 16 }}>
              <div>
                <label className="metric-label">Price (₹)</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0 for free"
                  required
                />
              </div>
              <div>
                <label className="metric-label">Cover Image URL (optional)</label>
                <input
                  className="input"
                  type="url"
                  value={coverImageUrl}
                  onChange={(e) => setCoverImageUrl(e.target.value)}
                  placeholder="https://..."
                />
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

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <Link
                href="/advisor/courses"
                className="input"
                style={{ width: "auto", padding: "12px 20px", textDecoration: "none", color: "inherit" }}
              >
                Cancel
              </Link>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? "Creating..." : "Create Course"}
              </button>
            </div>
          </article>

          <article className="card">
            <h3 style={{ marginTop: 0 }}>What's next</h3>
            <ol style={{ paddingLeft: 18, margin: 0, fontSize: 13, lineHeight: 1.8, color: "#334155" }}>
              <li>Course is created in draft mode</li>
              <li>Add lessons and video content</li>
              <li>Submit for admin compliance review</li>
              <li>Once approved, publish to start accepting enrollments</li>
              <li>Advisor gets 80% of each enrollment; platform fee 20%</li>
            </ol>
          </article>
        </div>
      </form>
    </section>
  );
}
