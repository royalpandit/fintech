"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  FiArrowLeft,
  FiSend,
  FiMessageCircle,
  FiPaperclip,
  FiFile,
  FiX,
  FiDownload,
} from "react-icons/fi";

type Message = {
  id: number;
  threadId: number;
  senderUserId: number;
  contentEnc: string;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  attachmentName?: string | null;
  createdAt: string;
  deletedAt: string | null;
  sender: { id: number; fullName: string };
};

type PendingAttachment = { url: string; type: "image" | "file"; name: string };

type Props = {
  threadId: number;
  userId: number;
  partner: { id: number; fullName: string } | null;
  initialMessages: Message[];
  backHref?: string;
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function timeLabel(date: string): string {
  const d = new Date(date);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(date: string): string {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export default function ChatClient({ threadId, userId, partner, initialMessages, backHref = "/user/messages" }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef<number>(initialMessages[initialMessages.length - 1]?.id ?? 0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setUploadError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/v1/messages/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || json.status === false) {
        setUploadError(json.error || "Upload failed");
        return;
      }
      setAttachment({ url: json.url, type: json.type, name: json.name });
    } catch {
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  // Scroll to bottom on load and new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Poll for new messages every 3 seconds
  const poll = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/v1/messages/threads/${threadId}?cursor=${lastIdRef.current}`,
      );
      if (!res.ok) return;
      const json = await res.json();
      const newMsgs: Message[] = json.data ?? [];
      if (newMsgs.length > 0) {
        setMessages((prev) => [...prev, ...newMsgs]);
        lastIdRef.current = newMsgs[newMsgs.length - 1].id;
      }
    } catch {
      // network error — silently ignore
    }
  }, [threadId]);

  useEffect(() => {
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [poll]);

  async function sendMessage() {
    const text = input.trim();
    if ((!text && !attachment) || sending || uploading) return;
    const sentAttachment = attachment;
    setSending(true);
    setInput("");
    setAttachment(null);

    // Optimistic message
    const optimistic: Message = {
      id: Date.now(), // temp id
      threadId,
      senderUserId: userId,
      contentEnc: text,
      attachmentUrl: sentAttachment?.url ?? null,
      attachmentType: sentAttachment?.type ?? null,
      attachmentName: sentAttachment?.name ?? null,
      createdAt: new Date().toISOString(),
      deletedAt: null,
      sender: { id: userId, fullName: "You" },
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await fetch(`/api/v1/messages/threads/${threadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: text,
          attachmentUrl: sentAttachment?.url,
          attachmentType: sentAttachment?.type,
          attachmentName: sentAttachment?.name,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        const real: Message = json.data;
        // Replace optimistic message with real one
        setMessages((prev) =>
          prev.map((m) => (m.id === optimistic.id ? real : m)),
        );
        lastIdRef.current = real.id;
      }
    } catch {
      // Remove optimistic on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(text);
      setAttachment(sentAttachment);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  // Group messages by day for date separators
  const grouped: { day: string; messages: Message[] }[] = [];
  for (const m of messages) {
    const d = dayLabel(m.createdAt);
    const last = grouped[grouped.length - 1];
    if (last && last.day === d) {
      last.messages.push(m);
    } else {
      grouped.push({ day: d, messages: [m] });
    }
  }

  return (
    <div className="dm-chat-root">

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 18px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "14px 14px 0 0",
          flexShrink: 0,
        }}
      >
        <Link
          href={backHref}
          style={{
            display: "flex",
            alignItems: "center",
            color: "var(--text-muted)",
            textDecoration: "none",
          }}
        >
          <FiArrowLeft size={18} />
        </Link>

        {partner ? (
          <>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background:
                  "linear-gradient(135deg, rgba(14,165,233,0.13), rgba(16,185,129,0.13))",
                color: "#0ea5e9",
                display: "grid",
                placeItems: "center",
                fontSize: 12,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {getInitials(partner.fullName)}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                {partner.fullName}
              </div>
              <div style={{ fontSize: 11, color: "#10b981" }}>Active now</div>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Conversation</div>
        )}
      </div>

      {/* Messages area */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          scrollBehavior: "smooth",
          padding: "18px",
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderTop: "none",
          borderBottom: "none",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted)",
              gap: 10,
            }}
          >
            <FiMessageCircle size={32} />
            <p style={{ margin: 0, fontSize: 13 }}>
              Start the conversation — say hello!
            </p>
          </div>
        )}

        {grouped.map((group) => (
          <div key={group.day}>
            {/* Day separator */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                margin: "12px 0 8px",
              }}
            >
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                {group.day}
              </span>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>

            {group.messages.map((m) => {
              const isMine = m.senderUserId === userId;
              return (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    justifyContent: isMine ? "flex-end" : "flex-start",
                    marginBottom: 6,
                  }}
                >
                  {!isMine && (
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 7,
                        background:
                          "linear-gradient(135deg, rgba(14,165,233,0.13), rgba(16,185,129,0.13))",
                        color: "#0ea5e9",
                        display: "grid",
                        placeItems: "center",
                        fontSize: 9,
                        fontWeight: 600,
                        flexShrink: 0,
                        marginRight: 8,
                        alignSelf: "flex-end",
                      }}
                    >
                      {getInitials(m.sender.fullName)}
                    </div>
                  )}
                  <div style={{ maxWidth: "70%" }}>
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: isMine ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                        background: isMine
                          ? "linear-gradient(135deg, #0ea5e9, #0284c7)"
                          : "var(--surface)",
                        color: isMine ? "#fff" : "var(--text)",
                        fontSize: 14,
                        lineHeight: 1.5,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                        wordBreak: "break-word",
                      }}
                    >
                      {m.deletedAt ? (
                        <em style={{ opacity: 0.6 }}>Message deleted</em>
                      ) : (
                        <>
                          {m.attachmentUrl && m.attachmentType === "image" && (
                            <a href={m.attachmentUrl} target="_blank" rel="noopener noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={m.attachmentUrl}
                                alt={m.attachmentName ?? "image"}
                                style={{
                                  display: "block",
                                  maxWidth: "100%",
                                  maxHeight: 240,
                                  borderRadius: 10,
                                  marginBottom: m.contentEnc ? 8 : 0,
                                }}
                              />
                            </a>
                          )}
                          {m.attachmentUrl && m.attachmentType === "file" && (
                            <a
                              href={m.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={m.attachmentName ?? true}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "8px 10px",
                                borderRadius: 10,
                                background: isMine ? "rgba(255,255,255,0.18)" : "var(--surface-2)",
                                color: "inherit",
                                textDecoration: "none",
                                marginBottom: m.contentEnc ? 8 : 0,
                                maxWidth: 260,
                              }}
                            >
                              <FiFile size={20} style={{ flexShrink: 0 }} />
                              <span
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  fontSize: 13,
                                  fontWeight: 600,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {m.attachmentName ?? "Document"}
                              </span>
                              <FiDownload size={15} style={{ flexShrink: 0, opacity: 0.8 }} />
                            </a>
                          )}
                          {m.contentEnc}
                        </>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--text-muted)",
                        marginTop: 3,
                        textAlign: isMine ? "right" : "left",
                        paddingInline: 2,
                      }}
                    >
                      {timeLabel(m.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div
        style={{
          padding: "12px 14px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "0 0 14px 14px",
          flexShrink: 0,
        }}
      >
        {uploadError && (
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "#dc2626" }}>{uploadError}</p>
        )}

        {(attachment || uploading) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              marginBottom: 8,
              borderRadius: 10,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
            }}
          >
            {uploading ? (
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Uploading…</span>
            ) : attachment?.type === "image" ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={attachment.url}
                  alt=""
                  style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 8 }}
                />
                <span style={{ flex: 1, fontSize: 13, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {attachment.name}
                </span>
              </>
            ) : (
              <>
                <FiFile size={20} style={{ color: "var(--text-muted)" }} />
                <span style={{ flex: 1, fontSize: 13, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {attachment?.name}
                </span>
              </>
            )}
            {attachment && (
              <button
                type="button"
                onClick={() => setAttachment(null)}
                aria-label="Remove attachment"
                style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}
              >
                <FiX size={16} />
              </button>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <input
            ref={fileInputRef}
            type="file"
            hidden
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
            onChange={onPickFile}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || sending}
            title="Attach image or document"
            aria-label="Attach file"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 44,
              height: 44,
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text-muted)",
              cursor: uploading || sending ? "default" : "pointer",
              flexShrink: 0,
            }}
          >
            <FiPaperclip size={18} />
          </button>

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
            rows={1}
            style={{
              flex: 1,
              resize: "none",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "10px 14px",
              fontSize: 14,
              outline: "none",
              lineHeight: 1.5,
              maxHeight: 120,
              overflowY: "auto",
              fontFamily: "inherit",
            }}
          />

          {(() => {
            const canSend = (input.trim() || attachment) && !sending && !uploading;
            return (
              <button
                type="button"
                onClick={sendMessage}
                disabled={!canSend}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  border: "none",
                  background: canSend
                    ? "linear-gradient(135deg, #0ea5e9, #0284c7)"
                    : "var(--border)",
                  color: canSend ? "#fff" : "var(--text-muted)",
                  cursor: canSend ? "pointer" : "default",
                  flexShrink: 0,
                  transition: "background 0.15s",
                }}
              >
                <FiSend size={16} />
              </button>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
