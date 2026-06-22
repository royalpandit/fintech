"use client";

import { useEffect, useRef, useState } from "react";
import { FiX } from "react-icons/fi";

export default function PostEditModal({
  open,
  initialValue,
  onCancel,
  onSave,
}: {
  open: boolean;
  initialValue: string;
  onCancel: () => void;
  onSave: (value: string) => Promise<void> | void;
}) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setValue(initialValue);
      setError("");
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
      });
    }
  }, [open, initialValue]);

  if (!open) return null;

  const submit = async () => {
    const next = value.trim();
    if (!next) {
      setError("Post can't be empty");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
      setSaving(false);
    }
  };

  return (
    <div className="sf-edit-overlay" onClick={onCancel} role="presentation">
      <div
        className="sf-edit-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label="Edit post"
      >
        <header className="sf-edit-head">
          <h3>Edit post</h3>
          <button type="button" className="sf-edit-close" onClick={onCancel} aria-label="Close">
            <FiX size={18} />
          </button>
        </header>
        <textarea
          ref={textareaRef}
          className="sf-edit-textarea"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
          rows={6}
          placeholder="Edit your post…"
        />
        {error && <p className="sf-edit-error">{error}</p>}
        <footer className="sf-edit-foot">
          <button type="button" className="sf-edit-cancel" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="sf-edit-save" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </footer>
      </div>
    </div>
  );
}
