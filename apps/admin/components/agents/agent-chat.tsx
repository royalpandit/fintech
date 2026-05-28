"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

interface Agent {
  id: number;
  name: string;
  description: string;
  avatar: string;
  model: string;
}

interface Message {
  role: "user" | "model";
  content: string;
  streaming?: boolean;
}

interface Session {
  id: number;
  title: string;
  updatedAt: string;
  _count: { messages: number };
}

function getToken() {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
  return m ? m[1] : null;
}

function authHeaders() {
  const t = getToken();
  return { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

function MarkdownText({ text }: { text: string }) {
  // Simple markdown: bold, code blocks, inline code, bullet lists
  const lines = text.split("\n");
  return (
    <div style={{ lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
      {lines.map((line, i) => {
        let content: React.ReactNode = line;
        // Bold **text**
        content = String(content).replace(/\*\*(.*?)\*\*/g, (_, t) => `<strong>${t}</strong>`);
        // Inline code `code`
        content = String(content).replace(/`([^`]+)`/g, (_, t) => `<code style="background:#f1f5f9;padding:1px 5px;border-radius:4px;font-size:0.9em;font-family:monospace">${t}</code>`);
        // Bullet
        const isBullet = line.startsWith("- ") || line.startsWith("• ");
        return (
          <div key={i} style={{ marginBottom: isBullet ? 2 : 0, paddingLeft: isBullet ? 14 : 0, position: "relative" }}>
            {isBullet && <span style={{ position: "absolute", left: 0 }}>•</span>}
            <span dangerouslySetInnerHTML={{ __html: typeof content === "string" ? (isBullet ? content.slice(2) : content) : "" }} />
          </div>
        );
      })}
    </div>
  );
}

export default function AgentChat({ agent }: { agent: Agent }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<number>(0);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => bottomRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => { scrollToBottom(); }, [messages]);

  const loadSessions = useCallback(async () => {
    const res = await fetch(`/api/v1/agents/${agent.id}/sessions`, { headers: authHeaders() });
    const json = await res.json();
    if (json.ok) setSessions(json.data);
  }, [agent.id]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  async function loadSession(sid: number) {
    const res = await fetch(`/api/v1/agents/${agent.id}/sessions?sessionId=${sid}`, {
      method: "PATCH", headers: authHeaders(),
    });
    const json = await res.json();
    if (json.ok) {
      setSessionId(sid);
      setMessages(json.data.messages.map((m: { role: string; content: string }) => ({ role: m.role as "user" | "model", content: m.content })));
      setSidebarOpen(false);
    }
  }

  function newChat() {
    setSessionId(0);
    setMessages([]);
    setInput("");
    setSidebarOpen(false);
    inputRef.current?.focus();
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;

    setMessages(prev => [...prev, { role: "user", content: text }]);
    setInput("");
    setSending(true);

    // Add streaming placeholder
    setMessages(prev => [...prev, { role: "model", content: "", streaming: true }]);

    try {
      const res = await fetch(`/api/v1/agents/${agent.id}/chat`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ message: text, sessionId: sessionId || undefined }),
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let fullText = "";
      let gotSession = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });

        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const d = JSON.parse(line.slice(6));
            if (d.sessionId && !gotSession) {
              setSessionId(d.sessionId); gotSession = true;
            }
            if (d.text) {
              fullText += d.text;
              const ft = fullText;
              setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = { role: "model", content: ft, streaming: true };
                return next;
              });
            }
            if (d.done) {
              setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = { role: "model", content: d.full || fullText, streaming: false };
                return next;
              });
            }
            if (d.error) {
              setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = { role: "model", content: `⚠️ ${d.error}`, streaming: false };
                return next;
              });
            }
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = { role: "model", content: `⚠️ ${String(e)}`, streaming: false };
        return next;
      });
    } finally {
      setSending(false);
      loadSessions();
      inputRef.current?.focus();
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const modelLabel = agent.model.replace("gemini-", "Gemini ").replace(/-/g, " ");

  return (
    <div style={{ display: "flex", height: "calc(100vh - 60px)", background: "#f8fafc", overflow: "hidden", position: "relative" }}>

      {/* Sidebar — chat history */}
      {sidebarOpen && (
        <div style={{ position: "absolute", inset: 0, zIndex: 50 }} onClick={() => setSidebarOpen(false)}>
          <div style={{ width: 280, height: "100%", background: "#fff", borderRight: "1px solid #e2e8f0", overflowY: "auto", padding: "16px 0" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "0 16px 12px", borderBottom: "1px solid #f1f5f9" }}>
              <button onClick={newChat} style={{ width: "100%", padding: "10px 14px", background: "linear-gradient(135deg,#6366f1,#4f46e5)", color: "#fff", border: "none", borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                + New Chat
              </button>
            </div>
            <div style={{ padding: "12px 8px 0" }}>
              {sessions.length === 0 ? (
                <p style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", padding: "20px 0" }}>No previous chats</p>
              ) : sessions.map(s => (
                <button key={s.id} onClick={() => loadSession(s.id)}
                  style={{ width: "100%", textAlign: "left", padding: "10px 12px", background: s.id === sessionId ? "#f0f9ff" : "transparent", border: "none", borderRadius: 8, cursor: "pointer", marginBottom: 2 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: s.id === sessionId ? "#0ea5e9" : "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{s._count.messages} messages</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main chat area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", background: "#fff", borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}>
          <Link href="/user/lab/agents" style={{ display: "flex", alignItems: "center", color: "#94a3b8", textDecoration: "none" }}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
          </Link>
          <button onClick={() => setSidebarOpen(v => !v)} style={{ border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#64748b" }}>
            ☰ History
          </button>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg,#ede9fe,#c7d2fe)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
            {agent.avatar}
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>{agent.name}</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>{modelLabel}</div>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <button onClick={newChat} style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#374151" }}>
              New Chat
            </button>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 20px" }}>
          {messages.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12, textAlign: "center" }}>
              <div style={{ width: 72, height: 72, borderRadius: 20, background: "linear-gradient(135deg,#ede9fe,#c7d2fe)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>
                {agent.avatar}
              </div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#0f172a" }}>{agent.name}</h2>
              <p style={{ margin: 0, fontSize: 14, color: "#64748b", maxWidth: 380, lineHeight: 1.6 }}>{agent.description}</p>
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "#94a3b8" }}>Ask me anything below to get started</p>
            </div>
          ) : (
            <div style={{ maxWidth: 740, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
              {messages.map((m, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
                  {/* Avatar */}
                  <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, background: m.role === "user" ? "linear-gradient(135deg,#6366f1,#4f46e5)" : "linear-gradient(135deg,#ede9fe,#c7d2fe)", color: m.role === "user" ? "#fff" : "inherit" }}>
                    {m.role === "user" ? "U" : agent.avatar}
                  </div>
                  {/* Bubble */}
                  <div style={{ maxWidth: "75%", padding: "12px 16px", borderRadius: m.role === "user" ? "16px 4px 16px 16px" : "4px 16px 16px 16px", background: m.role === "user" ? "linear-gradient(135deg,#6366f1,#4f46e5)" : "#fff", color: m.role === "user" ? "#fff" : "#0f172a", fontSize: 14, border: m.role === "model" ? "1px solid #e2e8f0" : "none", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                    {m.role === "model" ? (
                      <>
                        <MarkdownText text={m.content || "…"} />
                        {m.streaming && (
                          <span style={{ display: "inline-block", width: 8, height: 16, background: "#6366f1", borderRadius: 2, marginLeft: 2, animation: "blink 1s step-end infinite", verticalAlign: "middle" }} />
                        )}
                      </>
                    ) : (
                      <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.content}</span>
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div style={{ padding: "16px 20px", background: "#fff", borderTop: "1px solid #e2e8f0", flexShrink: 0 }}>
          <div style={{ maxWidth: 740, margin: "0 auto", display: "flex", gap: 10, alignItems: "flex-end" }}>
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
              placeholder={`Message ${agent.name}…`} rows={1}
              disabled={sending}
              style={{ flex: 1, padding: "12px 16px", border: "1.5px solid #e2e8f0", borderRadius: 12, fontSize: 14, resize: "none", outline: "none", fontFamily: "inherit", lineHeight: 1.5, minHeight: 48, maxHeight: 200, overflowY: "auto", boxSizing: "border-box", background: sending ? "#f8fafc" : "#fff" }}
              onInput={e => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 200) + "px"; }} />
            <button onClick={send} disabled={sending || !input.trim()}
              style={{ width: 48, height: 48, borderRadius: 12, background: sending || !input.trim() ? "#e2e8f0" : "linear-gradient(135deg,#6366f1,#4f46e5)", border: "none", cursor: sending || !input.trim() ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.2s" }}>
              {sending ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={input.trim() ? "#fff" : "#94a3b8"} strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              )}
            </button>
          </div>
          <p style={{ maxWidth: 740, margin: "8px auto 0", fontSize: 11, color: "#94a3b8", textAlign: "center" }}>
            Press Enter to send • Shift+Enter for new line • Powered by {modelLabel}
          </p>
        </div>
      </div>
      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
