"use client";

import { useState } from "react";
import { FiCheckCircle, FiCircle, FiPlay, FiLock, FiClock } from "react-icons/fi";

type Lesson = {
  id: number;
  title: string;
  position: number;
  durationSeconds: number | null;
  videoUrl: string | null;
};

type Props = {
  courseId: number;
  lessons: Lesson[];
  isEnrolled: boolean;
  completedLessonIds: number[];
  isAuthed: boolean;
};

function fmtSecs(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function CourseDetailClient({
  courseId,
  lessons,
  isEnrolled,
  completedLessonIds: initial,
  isAuthed,
}: Props) {
  const [completed, setCompleted] = useState<Set<number>>(new Set(initial));
  const [toggling, setToggling] = useState<number | null>(null);

  async function toggleComplete(lessonId: number) {
    if (!isEnrolled || toggling !== null) return;
    setToggling(lessonId);
    const wasComplete = completed.has(lessonId);

    setCompleted((prev) => {
      const next = new Set(prev);
      wasComplete ? next.delete(lessonId) : next.add(lessonId);
      return next;
    });

    try {
      await fetch(`/api/v1/courses/${courseId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, completed: !wasComplete }),
      });
    } catch {
      // Revert on error
      setCompleted((prev) => {
        const next = new Set(prev);
        wasComplete ? next.add(lessonId) : next.delete(lessonId);
        return next;
      });
    } finally {
      setToggling(null);
    }
  }

  const totalLessons = lessons.length;
  const completedCount = completed.size;
  const progressPct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  return (
    <div>
      {/* Progress bar (enrolled only) */}
      {isEnrolled && (
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-muted)",
              marginBottom: 8,
            }}
          >
            <span>Your progress</span>
            <span>
              {completedCount}/{totalLessons} completed
            </span>
          </div>
          <div
            style={{
              height: 6,
              borderRadius: 999,
              background: "#e2e8f0",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                borderRadius: 999,
                background: "linear-gradient(90deg, #0ea5e9, #10b981)",
                width: `${progressPct}%`,
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>
      )}

      {/* Lesson list */}
      {lessons.map((lesson, idx) => {
        const isDone = completed.has(lesson.id);
        const isLocked = !isEnrolled && idx > 0;

        return (
          <div
            key={lesson.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "13px 20px",
              borderBottom: idx < lessons.length - 1 ? "1px solid var(--border)" : "none",
              background: isDone ? "rgba(34,197,94,0.12)" : "transparent",
              transition: "background 0.15s",
            }}
          >
            {/* Complete toggle */}
            <button
              type="button"
              onClick={() => toggleComplete(lesson.id)}
              disabled={!isEnrolled || toggling === lesson.id}
              title={isEnrolled ? (isDone ? "Mark incomplete" : "Mark complete") : "Enroll to track progress"}
              style={{
                background: "none",
                border: "none",
                cursor: isEnrolled ? "pointer" : "default",
                color: isDone ? "#10b981" : "#cbd5e1",
                display: "flex",
                alignItems: "center",
                padding: 0,
                flexShrink: 0,
              }}
            >
              {isDone ? <FiCheckCircle size={18} /> : <FiCircle size={18} />}
            </button>

            {/* Position number */}
            <span
              style={{
                width: 22,
                fontSize: 12,
                fontWeight: 700,
                color: "var(--text-muted)",
                flexShrink: 0,
                textAlign: "center",
              }}
            >
              {lesson.position}
            </span>

            {/* Title */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: isLocked ? "var(--text-muted)" : "var(--text)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {isLocked && <FiLock size={12} style={{ color: "var(--text-muted)" }} />}
                {lesson.title}
              </span>
            </div>

            {/* Duration */}
            {lesson.durationSeconds && (
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  flexShrink: 0,
                }}
              >
                <FiClock size={11} /> {fmtSecs(lesson.durationSeconds)}
              </span>
            )}

            {/* Play button (enrolled + has video) */}
            {isEnrolled && lesson.videoUrl ? (
              <a
                href={lesson.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: "rgba(14,165,233,0.1)",
                  color: "#0ea5e9",
                  flexShrink: 0,
                }}
              >
                <FiPlay size={13} />
              </a>
            ) : !isEnrolled && idx === 0 && lesson.videoUrl ? (
              <a
                href={lesson.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Preview"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: "rgba(14,165,233,0.1)",
                  color: "#0ea5e9",
                  flexShrink: 0,
                }}
              >
                <FiPlay size={13} />
              </a>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
