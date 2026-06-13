"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function ReportComposer() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [access, setAccess] = useState<"free" | "paid">("free");
  const [price, setPrice] = useState("");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setTitle("");
    setDescription("");
    setAccess("free");
    setPrice("");
    setFileName("");
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Please choose a PDF file to upload");
      return;
    }
    if (file.type !== "application/pdf") {
      setError("Only PDF files are allowed");
      return;
    }
    if (access === "paid" && !(Number(price) > 0)) {
      setError("A paid report needs a price greater than 0");
      return;
    }

    setLoading(true);
    try {
      // 1) Upload the PDF.
      const fd = new FormData();
      fd.append("file", file);
      const upRes = await fetch("/api/v1/uploads/report", { method: "POST", body: fd });
      const upData = await upRes.json();
      if (!upRes.ok || upData.status === false) {
        setError(upData.error || "Upload failed");
        setLoading(false);
        return;
      }

      // 2) Create the report record.
      const res = await fetch("/api/v1/advisor/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          fileUrl: upData.url,
          fileName: upData.fileName,
          fileSize: upData.fileSize,
          accessType: access,
          price: access === "paid" ? Number(price) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.status === false) {
        setError(data.error || "Failed to create report");
        setLoading(false);
        return;
      }

      reset();
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button type="button" className="btn-primary" style={{ padding: "12px 20px" }} onClick={() => setOpen(true)}>
        + New Report
      </button>
    );
  }

  return (
    <article className="card" style={{ width: "100%", maxWidth: 560 }}>
      <h3 style={{ marginTop: 0, marginBottom: 4 }}>Upload a report</h3>
      <p className="page-subtitle" style={{ marginTop: 0, marginBottom: 16 }}>
        Upload a PDF research report. It publishes immediately.
      </p>

      <form onSubmit={submit}>
        <label className="metric-label">Title *</label>
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Q2 FY26 Banking Sector Outlook"
          required
          minLength={3}
        />

        <label className="metric-label" style={{ marginTop: 16 }}>
          Description
        </label>
        <textarea
          className="input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="A short summary of what's inside the report."
          style={{ resize: "vertical" }}
        />

        <label className="metric-label" style={{ marginTop: 16 }}>
          PDF file *
        </label>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
          required
          style={{ display: "block", fontSize: 13, marginTop: 4 }}
        />
        {fileName && (
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Selected: {fileName}</div>
        )}

        <label className="metric-label" style={{ marginTop: 16 }}>
          Access
        </label>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          {(["free", "paid"] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAccess(a)}
              style={{
                flex: 1,
                padding: "10px 0",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: access === a ? "#0ea5e9" : "#fff",
                color: access === a ? "#fff" : "#334155",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {a}
            </button>
          ))}
        </div>

        {access === "paid" && (
          <div style={{ marginTop: 12 }}>
            <label className="metric-label">Price (₹) *</label>
            <input
              className="input"
              type="number"
              min={1}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 499"
            />
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: 16,
              padding: "10px 12px",
              background: "#fef2f2",
              color: "#b91c1c",
              borderRadius: 10,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <button
            type="button"
            className="input"
            style={{ width: "auto", padding: "12px 20px", cursor: "pointer" }}
            onClick={() => {
              reset();
              setOpen(false);
            }}
            disabled={loading}
          >
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Uploading…" : "Publish report"}
          </button>
        </div>
      </form>
    </article>
  );
}
