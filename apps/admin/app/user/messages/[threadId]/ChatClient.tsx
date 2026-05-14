"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { FiArrowLeft, FiSend, FiMessageCircle } from "react-icons/fi";

type Message = {
  id: number;
  threadId: number;
  senderUserId: number;
  contentEnc: string;
  createdAt: string;
  deletedAt: string | null;
  sender: { id: number; fullName: string };
};

type Props = {
  threadId: number;
  userId: number;
  partner: { id: number; fullName: string } | null;
  initialMessages: Message[];
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

export default function ChatClient({ threadId, userId, partner, initialMessages }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef<number>(initialMessages[initialMessages.length - 1]?.id ?? 0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
    if (!text || sending) return;
    setSending(true);
    setInput("");

    // Optimistic message
    const optimistic: Message = {
      id: Date.now(), // temp id
      threadId,
      senderUserId: userId,
      contentEnc: text,
      createdAt: new Date().toISOString(),
      deletedAt: null,
      sender: { id: userId, fullName: "You" },
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await fetch(`/api/v1/messages/threads/${threadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 120px)",
        minHeight: 500,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 18px",
          background: "#fff",
          border: "1px solid #eef0f4",
          borderRadius: "14px 14px 0 0",
          flexShrink: 0,
        }}
      >
        <Link
          href="/user/messages"
          style={{
            display: "flex",
            alignItems: "center",
            color: "#64748b",
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
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              {getInitials(partner.fullName)}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                {partner.fullName}
              </div>
              <div style={{ fontSize: 11, color: "#10b981" }}>Active now</div>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Conversation</div>
        )}
      </div>

      {/* Messages area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "18px",
          background: "#f8fafc",
          border: "1px solid #eef0f4",
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
              color: "#94a3b8",
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
              <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
              <span
                style={{
                  fontSize: 11,
                  color: "#94a3b8",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                {group.day}
              </span>
              <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
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
                        fontWeight: 800,
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
                          : "#fff",
                        color: isMine ? "#fff" : "#0f172a",
                        fontSize: 14,
                        lineHeight: 1.5,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                        wordBreak: "break-word",
                      }}
                    >
                      {m.deletedAt ? (
                        <em style={{ opacity: 0.6 }}>Message deleted</em>
                      ) : (
                        m.contentEnc
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "#94a3b8",
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
          display: "flex",
          gap: 10,
          padding: "12px 14px",
          background: "#fff",
          border: "1px solid #eef0f4",
          borderRadius: "0 0 14px 14px",
          flexShrink: 0,
          alignItems: "flex-end",
        }}
      >
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
            border: "1px solid #e2e8f0",
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
        <button
          type="button"
          onClick={sendMessage}
          disabled={!input.trim() || sending}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 44,
            height: 44,
            borderRadius: 10,
            border: "none",
            background:
              input.trim() && !sending
                ? "linear-gradient(135deg, #0ea5e9, #0284c7)"
                : "#e2e8f0",
            color: input.trim() && !sending ? "#fff" : "#94a3b8",
            cursor: input.trim() && !sending ? "pointer" : "default",
            flexShrink: 0,
            transition: "background 0.15s",
          }}
        >
          <FiSend size={16} />
        </button>
      </div>
    </div>
  );
}
