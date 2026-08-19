"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FiCamera, FiUser } from "react-icons/fi";
import { IMAGE_ACCEPT_ATTR } from "@/lib/upload-types";

type Props = {
  user: { fullName: string; email: string; phone: string; avatarUrl: string | null };
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 38,
  padding: "0 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  fontSize: 13,
  outline: "none",
  marginBottom: 12,
  boxSizing: "border-box",
  background: "var(--surface)",
  color: "var(--text)",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-muted)",
  marginBottom: 4,
};

export default function AccountForm({ user }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone);
  const [avatar, setAvatar] = useState<string | null>(user.avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/v1/uploads/social", { method: "POST", body: fd });
      const j = await res.json();
      if ((j.ok || j.status) && j.url) {
        setAvatar(j.url);
      } else {
        setMsg({ text: j.error || "Upload failed", ok: false });
      }
    } catch {
      setMsg({ text: "Upload failed", ok: false });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/v1/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, phone, avatarUrl: avatar }),
      });
      const j = await res.json();
      if (j.ok || j.status) {
        setMsg({ text: "Saved", ok: true });
        router.refresh();
      } else {
        setMsg({ text: j.error || "Couldn't save", ok: false });
      }
    } catch {
      setMsg({ text: "Network error", ok: false });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Avatar */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            overflow: "hidden",
            background: avatar ? "transparent" : "linear-gradient(135deg,#0ea5e9,#10b981)",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontWeight: 700,
            fontSize: 20,
            flexShrink: 0,
          }}
        >
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            initials(fullName || "U")
          )}
        </div>
        <div>
          <input ref={fileRef} type="file" accept={IMAGE_ACCEPT_ATTR} onChange={onPick} style={{ display: "none" }} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text)",
              fontSize: 12,
              fontWeight: 600,
              cursor: uploading ? "wait" : "pointer",
            }}
          >
            <FiCamera size={14} /> {uploading ? "Uploading…" : avatar ? "Change photo" : "Upload photo"}
          </button>
          {avatar && (
            <button
              type="button"
              onClick={() => setAvatar(null)}
              style={{
                marginLeft: 8,
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "#dc2626",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Remove
            </button>
          )}
          <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--text-muted)" }}>
            JPG, PNG, WebP, GIF or AVIF — up to 10MB.
          </p>
        </div>
      </div>

      <label style={labelStyle}>Full Name</label>
      <input value={fullName} onChange={(e) => setFullName(e.target.value)} style={inputStyle} />

      <label style={labelStyle}>Email</label>
      <input value={user.email} type="email" disabled style={{ ...inputStyle, opacity: 0.7 }} />

      <label style={labelStyle}>Phone</label>
      <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" style={{ ...inputStyle, marginBottom: 16 }} />

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          onClick={save}
          disabled={saving || uploading}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 18px",
            borderRadius: 10,
            background: "#0ea5e9",
            color: "#fff",
            fontWeight: 700,
            fontSize: 12,
            border: "none",
            cursor: saving ? "wait" : "pointer",
            opacity: saving || uploading ? 0.7 : 1,
          }}
        >
          <FiUser size={14} /> {saving ? "Saving…" : "Save changes"}
        </button>
        {msg && (
          <span style={{ fontSize: 12, fontWeight: 600, color: msg.ok ? "#16a34a" : "#dc2626" }}>
            {msg.text}
          </span>
        )}
      </div>
    </>
  );
}
