"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Lesson = {
  id: number;
  title: string;
  position: number;
  videoUrl: string | null;
  durationSeconds: number | null;
};

function formatDuration(secs: number | null): string {
  if (!secs) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function LessonsManager({
  courseId,
  initialLessons,
}: {
  courseId: number;
  initialLessons: Lesson[];
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [duration, setDuration] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editVideoUrl, setEditVideoUrl] = useState("");
  const [editDuration, setEditDuration] = useState("");

  const startEdit = (lesson: Lesson) => {
    setEditingId(lesson.id);
    setEditTitle(lesson.title);
    setEditVideoUrl(lesson.videoUrl ?? "");
    setEditDuration(lesson.durationSeconds ? String(lesson.durationSeconds) : "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditVideoUrl("");
    setEditDuration("");
  };

  const addLesson = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/advisor/courses/${courseId}/lessons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          videoUrl: videoUrl.trim() || undefined,
          durationSeconds: duration ? Number(duration) : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.status === false) {
        setError(data.error || "Failed to add");
        setLoading(false);
        return;
      }
      setTitle("");
      setVideoUrl("");
      setDuration("");
      setAddOpen(false);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/v1/advisor/courses/${courseId}/lessons/${editingId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editTitle.trim(),
            videoUrl: editVideoUrl.trim() || null,
            durationSeconds: editDuration ? Number(editDuration) : null,
          }),
        },
      );
      const data = await response.json();
      if (!response.ok || data.status === false) {
        setError(data.error || "Failed to save");
        setLoading(false);
        return;
      }
      cancelEdit();
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const deleteLesson = async (lessonId: number) => {
    if (!confirm("Delete this lesson? This cannot be undone.")) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/v1/advisor/courses/${courseId}/lessons/${lessonId}`,
        { method: "DELETE" },
      );
      const data = await response.json();
      if (!response.ok || data.status === false) {
        setError(data.error || "Failed");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <article className="card" style={{ marginTop: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <h3 style={{ margin: 0 }}>Lessons ({initialLessons.length})</h3>
        <button
          type="button"
          className="btn-primary"
          style={{ padding: "8px 14px" }}
          onClick={() => setAddOpen(!addOpen)}
        >
          {addOpen ? "Cancel" : "+ Add Lesson"}
        </button>
      </div>

      {addOpen && (
        <form
          onSubmit={addLesson}
          style={{
            marginBottom: 16,
            padding: 14,
            border: "1px dashed var(--border)",
            borderRadius: 10,
            background: "#f8fafc",
          }}
        >
          <div className="grid" style={{ gridTemplateColumns: "2fr 2fr 100px", gap: 10 }}>
            <input
              className="input"
              placeholder="Lesson title *"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={3}
            />
            <input
              className="input"
              type="url"
              placeholder="Video URL"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
            />
            <input
              className="input"
              type="number"
              placeholder="Secs"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              min={0}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Adding..." : "Add Lesson"}
            </button>
          </div>
        </form>
      )}

      {error && (
        <div
          style={{
            marginBottom: 12,
            padding: "8px 12px",
            background: "#fef2f2",
            color: "#b91c1c",
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {initialLessons.length === 0 ? (
        <p className="page-subtitle" style={{ margin: 0, textAlign: "center", padding: 24 }}>
          No lessons yet. Add your first one to start building your course.
        </p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Title</th>
                <th>Video</th>
                <th style={{ width: 90 }}>Duration</th>
                <th style={{ width: 160 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {initialLessons.map((lesson) =>
                editingId === lesson.id ? (
                  <tr key={lesson.id} style={{ background: "#f0fdf4" }}>
                    <td>{lesson.position}</td>
                    <td>
                      <input
                        className="input"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="input"
                        type="url"
                        value={editVideoUrl}
                        onChange={(e) => setEditVideoUrl(e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="input"
                        type="number"
                        value={editDuration}
                        onChange={(e) => setEditDuration(e.target.value)}
                      />
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          onClick={saveEdit}
                          disabled={loading}
                          className="btn-primary"
                          style={{ padding: "6px 12px", fontSize: 12 }}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="input"
                          style={{ width: "auto", padding: "6px 12px", fontSize: 12 }}
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={lesson.id}>
                    <td style={{ fontWeight: 700, color: "#64748b" }}>{lesson.position}</td>
                    <td style={{ fontWeight: 600 }}>{lesson.title}</td>
                    <td style={{ fontSize: 12, color: "#64748b" }}>
                      {lesson.videoUrl ? (
                        <a
                          href={lesson.videoUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "#2563eb" }}
                        >
                          ↗ link
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{formatDuration(lesson.durationSeconds)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => startEdit(lesson)}
                          className="input"
                          style={{ width: "auto", padding: "6px 10px", fontSize: 12 }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteLesson(lesson.id)}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 8,
                            border: "1px solid #fecaca",
                            background: "#fff",
                            color: "#dc2626",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
