"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Agent = { id: number; name: string; avatar: string; description: string };
type Msg = { role: "user" | "model"; content: string };

// The chatbot shows everywhere EXCEPT the admin / super-admin / moderator consoles.
const HIDDEN_PREFIXES = ["/super-admin", "/admin", "/moderator"];

export default function ChatWidget() {
  const pathname = usePathname();
  const hidden = HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));

  const [agent, setAgent] = useState<Agent | null>(null);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const sessionRef = useRef<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hidden) return;
    fetch("/api/v1/assistant")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.agent) setAgent(j.agent);
      })
      .catch(() => {});
  }, [hidden]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  if (hidden || !agent) return null;

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }, { role: "model", content: "" }]);
    setSending(true);

    const appendToModel = (chunk: string) =>
      setMessages((m) => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        if (last?.role === "model") copy[copy.length - 1] = { ...last, content: last.content + chunk };
        return copy;
      });
    const setModel = (full: string) =>
      setMessages((m) => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        if (last?.role === "model") copy[copy.length - 1] = { ...last, content: full };
        return copy;
      });

    try {
      const res = await fetch(`/api/v1/agents/${agent!.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId: sessionRef.current || undefined }),
      });
      if (res.status === 401) {
        setNeedsLogin(true);
        setModel("Please sign in to chat with me — it only takes a minute.");
        return;
      }
      if (!res.body) {
        setModel("Sorry, I couldn't respond right now.");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          try {
            const j = JSON.parse(line.slice(6));
            if (j.sessionId) sessionRef.current = j.sessionId;
            if (j.error) setModel("⚠️ " + j.error);
            else if (j.full) setModel(j.full);
            else if (j.text) appendToModel(j.text);
          } catch {
            /* ignore partial */
          }
        }
      }
    } catch {
      setModel("Network error — please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Launcher bubble */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Chat with ${agent.name}`}
          style={{
            position: "fixed",
            bottom: 22,
            right: 22,
            width: 56,
            height: 56,
            borderRadius: 999,
            border: "none",
            background: "linear-gradient(135deg,#2563eb,#10b981)",
            color: "#fff",
            fontSize: 26,
            cursor: "pointer",
            boxShadow: "0 8px 26px rgba(37,99,235,0.36)",
            zIndex: 300,
            display: "grid",
            placeItems: "center",
          }}
        >
          {agent.avatar || "💬"}
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 22,
            right: 22,
            width: "min(380px, calc(100vw - 32px))",
            height: "min(560px, calc(100vh - 100px))",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            boxShadow: "0 20px 60px rgba(15,23,42,0.28)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            zIndex: 300,
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", background: "linear-gradient(135deg,#2563eb,#10b981)", color: "#fff" }}>
            <span style={{ fontSize: 22 }}>{agent.avatar || "💬"}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{agent.name}</div>
              <div style={{ fontSize: 11, opacity: 0.85, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {agent.description || "AI assistant"}
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" style={{ border: "none", background: "transparent", color: "#fff", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>
              ×
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.length === 0 && (
              <div style={{ margin: "auto", textAlign: "center", color: "var(--text-muted)", fontSize: 13, padding: 20 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>{agent.avatar || "💬"}</div>
                Hi! I&apos;m {agent.name}. Ask me anything.
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  padding: "9px 12px",
                  borderRadius: 12,
                  fontSize: 13.5,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                  background: m.role === "user" ? "var(--primary-soft, rgba(37,99,235,0.12))" : "var(--surface-2)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                }}
              >
                {m.content || (sending && i === messages.length - 1 ? "…" : "")}
              </div>
            ))}
          </div>

          {/* Input */}
          {needsLogin ? (
            <div style={{ padding: 12, borderTop: "1px solid var(--border)", display: "flex", gap: 8, alignItems: "center" }}>
              <Link
                href="/login"
                style={{ flex: 1, textAlign: "center", height: 40, lineHeight: "40px", borderRadius: 10, background: "var(--accent-blue, #2563eb)", color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
              >
                Sign in to chat
              </Link>
              <Link
                href="/register"
                style={{ flex: 1, textAlign: "center", height: 40, lineHeight: "40px", borderRadius: 10, border: "1px solid var(--border)", color: "var(--text)", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
              >
                Create account
              </Link>
            </div>
          ) : (
          <div style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid var(--border)" }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Type a message…"
              disabled={sending}
              style={{ flex: 1, height: 40, padding: "0 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, outline: "none" }}
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending || !input.trim()}
              style={{ height: 40, padding: "0 16px", borderRadius: 10, border: "none", background: "var(--accent-blue, #2563eb)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: sending ? "wait" : "pointer", opacity: !input.trim() ? 0.6 : 1 }}
            >
              Send
            </button>
          </div>
          )}
        </div>
      )}
    </>
  );
}
