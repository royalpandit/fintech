"use client";

import { useRef, useState } from "react";
import { FiFileText, FiPaperclip, FiX } from "react-icons/fi";

export type DocAttachment = {
  fileName: string;
  text: string;
  hasTables?: boolean;
};

function getToken() {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
  return m ? m[1] : null;
}

/** Shared PDF / Word attach for every assistant chat surface. */
export function useDocumentAttach() {
  const [docAttachment, setDocAttachment] = useState<DocAttachment | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docError, setDocError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function clearDoc() {
    setDocAttachment(null);
    setDocError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onPickDocument(file: File | null) {
    if (!file || uploadingDoc) return;
    setDocError("");
    setUploadingDoc(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const t = getToken();
      const res = await fetch("/api/v1/agents/extract-document", {
        method: "POST",
        body: fd,
        credentials: "include",
        headers: t ? { Authorization: `Bearer ${t}` } : undefined,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !(j.ok || j.status)) {
        throw new Error(j.error || "Couldn't read that document");
      }
      setDocAttachment({
        fileName: j.fileName || file.name,
        text: j.text as string,
        hasTables: Boolean(j.hasTables),
      });
    } catch (e) {
      setDocAttachment(null);
      setDocError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingDoc(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  /** Build display + model payloads when a doc is attached. */
  function buildDocMessage(typed: string) {
    if (!docAttachment) {
      return { display: typed, messageForModel: typed };
    }
    const tag = docAttachment.hasTables ? " (tables extracted)" : "";
    const display = typed
      ? `${typed}\n\n[Document] ${docAttachment.fileName}${tag}`
      : `Attached: ${docAttachment.fileName}${tag}`;
    const messageForModel = [
      typed ||
        "Please review the attached document. Summarize key points and explain any tables clearly.",
      "",
      `--- Begin attached document: ${docAttachment.fileName} ---`,
      docAttachment.text,
      `--- End attached document ---`,
    ].join("\n");
    return { display, messageForModel };
  }

  return {
    fileRef,
    docAttachment,
    uploadingDoc,
    docError,
    clearDoc,
    setDocError,
    onPickDocument,
    buildDocMessage,
    openPicker: () => fileRef.current?.click(),
  };
}

type ChipProps = {
  docAttachment: DocAttachment | null;
  uploadingDoc: boolean;
  docError: string;
  onClear: () => void;
};

export function DocumentAttachChip({ docAttachment, uploadingDoc, docError, onClear }: ChipProps) {
  if (!docAttachment && !docError && !uploadingDoc) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
      {uploadingDoc ? (
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Reading PDF / Word document…</span>
      ) : null}
      {docError ? <span style={{ fontSize: 12, color: "#b91c1c" }}>{docError}</span> : null}
      {docAttachment ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 10,
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            fontSize: 13,
          }}
        >
          <FiFileText size={16} style={{ flexShrink: 0, color: "var(--text-muted)" }} aria-hidden />
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {docAttachment.fileName}
            {docAttachment.hasTables ? " · tables detected" : ""}
          </span>
          <button
            type="button"
            onClick={onClear}
            aria-label="Remove attachment"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              padding: 2,
              lineHeight: 1,
            }}
          >
            <FiX size={16} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

type ButtonProps = {
  fileRef: React.RefObject<HTMLInputElement | null>;
  disabled?: boolean;
  uploadingDoc?: boolean;
  onPick: (file: File | null) => void;
  size?: number;
};

export function DocumentAttachButton({
  fileRef,
  disabled,
  uploadingDoc,
  onPick,
  size = 48,
}: ButtonProps) {
  const iconSize = Math.round(size * 0.42);
  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        hidden
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={disabled || uploadingDoc}
        title="Attach PDF or Word (.docx)"
        aria-label="Attach PDF or Word document"
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          border: "1.5px solid var(--border)",
          background: "var(--surface-2)",
          cursor: uploadingDoc ? "wait" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "var(--text)",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <FiPaperclip size={iconSize} aria-hidden />
      </button>
    </>
  );
}
