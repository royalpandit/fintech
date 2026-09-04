"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  DocumentAttachButton,
  DocumentAttachChip,
  useDocumentAttach,
} from "@/components/agents/document-attach";
import AgentMarkdown from "@/components/agents/agent-markdown";

interface Agent {
  id: number;
  name: string;
  description: string;
  avatar: string;
  model: string;
  /** Suggested openers, set per agent in /super-admin/agents. May be empty. */
  starterPrompts?: string[];
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

/**
 * Copy an answer out of the transcript.
 *
 * These replies routinely get pasted into a note or a post, and selecting a
 * long multi-block answer by hand picks up the avatar and name row with it.
 */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="agent-copy-btn"
      aria-label={copied ? "Copied" : "Copy reply"}
      title={copied ? "Copied" : "Copy reply"}
      onClick={() => {
        void navigator.clipboard
          .writeText(text)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          })
          // Clipboard access can be denied (insecure origin, permission) — say
          // nothing rather than flashing a success state that did not happen.
          .catch(() => {});
      }}
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="12" height="12" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
      )}
      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

function userInitials(name: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "You";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function AgentChat({
  agent,
  userName = null,
  userAvatar = null,
  /* The advisor console mounts this at /advisor/agents/[id]; its back link has
     to return there rather than into the investor shell. */
  backHref = "/user/lab/agents",
}: {
  agent: Agent;
  userName?: string | null;
  userAvatar?: string | null;
  backHref?: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<number>(0);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const {
    fileRef,
    docAttachment,
    uploadingDoc,
    docError,
    clearDoc,
    onPickDocument,
    buildDocMessage,
  } = useDocumentAttach();

  /**
   * Auto-scroll, but only while the reader is already at the bottom.
   *
   * This used to be a plain scrollIntoView({ behavior: "smooth" }) in an effect
   * keyed on `messages`. Streaming rewrites that array on every token, so the
   * browser was starting a fresh smooth-scroll animation dozens of times a
   * second, each one interrupting the last — that is the "laggy scroll". Worse,
   * it fired unconditionally, so scrolling up to re-read something yanked you
   * straight back to the bottom on the next token.
   *
   * Now: an instant scroll (a smooth animation cannot keep up with a token
   * stream anyway), coalesced into one per frame, and skipped entirely when the
   * reader has scrolled away. `pinned` drives the "Jump to latest" button.
   */
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const rafRef = useRef<number | null>(null);
  const [pinned, setPinned] = useState(true);

  // 80px of slack: a reader sitting a line or two off the bottom still counts
  // as following along.
  const PIN_SLACK = 80;

  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < PIN_SLACK;
    pinnedRef.current = atBottom;
    setPinned((p) => (p === atBottom ? p : atBottom));
  }, []);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollerRef.current;
    if (!el) return;
    pinnedRef.current = true;
    setPinned(true);
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    if (!pinnedRef.current) return;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const el = scrollerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [messages]);

  const loadSessions = useCallback(async () => {
    const res = await fetch(`/api/v1/agents/${agent.id}/sessions`, { headers: authHeaders() });
    const json = await res.json();
    if (json.ok) setSessions(json.data);
  }, [agent.id]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  async function loadSession(sid: number) {
    const res = await fetch(`/api/v1/agents/${agent.id}/sessions?sessionId=${sid}`, {
      method: "PATCH",
      headers: authHeaders(),
    });
    const json = await res.json();
    if (json.ok) {
      setSessionId(sid);
      setMessages(
        json.data.messages.map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "model",
          content: m.content,
        })),
      );
      setSidebarOpen(false);
    }
  }

  function newChat() {
    setSessionId(0);
    setMessages([]);
    setInput("");
    clearDoc();
    setSidebarOpen(false);
    inputRef.current?.focus();
  }

  /** `override` lets a starter chip send its own text without typing it first. */
  async function send(override?: string) {
    const typed = (override ?? input).trim();
    if ((!typed && !docAttachment) || sending || uploadingDoc) return;

    const { display, messageForModel } = buildDocMessage(typed);

    setMessages((prev) => [...prev, { role: "user", content: display }]);
    setInput("");
    clearDoc();
    setSending(true);
    setMessages((prev) => [...prev, { role: "model", content: "", streaming: true }]);

    try {
      const res = await fetch(`/api/v1/agents/${agent.id}/chat`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ message: messageForModel, sessionId: sessionId || undefined }),
      });

      // A non-SSE reply (401 session expired, 404 agent, 500) has a body, but no
      // line in it starts with "data: " — so the parser below found nothing, the
      // placeholder kept `streaming: true`, and the chat sat on a typing
      // indicator forever with no clue why. Surface it instead.
      if (!res.ok) {
        let detail = `Request failed (${res.status})`;
        try {
          const j = await res.json();
          if (j?.error) detail = String(j.error);
        } catch {
          /* not JSON — keep the status line */
        }
        if (res.status === 401) detail = "Your session expired — sign in again to keep chatting.";
        throw new Error(detail);
      }
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let fullText = "";
      let gotSession = false;
      let sawError = false;

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
              setSessionId(d.sessionId);
              gotSession = true;
            }
            if (d.text) {
              fullText += d.text;
              const ft = fullText;
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = { role: "model", content: ft, streaming: true };
                return next;
              });
            }
            if (d.done) {
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = {
                  role: "model",
                  content: d.full || fullText,
                  streaming: false,
                };
                return next;
              });
            }
            if (d.error) {
              sawError = true;
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = {
                  role: "model",
                  content: `⚠️ ${d.error}`,
                  streaming: false,
                };
                return next;
              });
            }
          } catch {
            /* skip */
          }
        }
      }

      // The stream can close having produced nothing — a model that returns no
      // candidates, or a response cut off before any text. Never leave the
      // placeholder stuck mid-stream.
      if (!fullText && !sawError) {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "model",
            content: "⚠️ No response came back. Try again, or rephrase your message.",
            streaming: false,
          };
          return next;
        });
      }
    } catch (e) {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "model",
          content: `⚠️ ${e instanceof Error ? e.message : String(e)}`,
          streaming: false,
        };
        return next;
      });
    } finally {
      setSending(false);
      loadSessions();
      inputRef.current?.focus();
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  // Give the shell a definite height so the transcript scrolls internally
  // instead of the whole page scrolling behind it.
  useEffect(() => {
    document.body.classList.add("agent-chat-active");
    return () => document.body.classList.remove("agent-chat-active");
  }, []);

  const modelLabel = agent.model.replace("gemini-", "Gemini ").replace(/-/g, " ");
  const canSend = Boolean(input.trim() || docAttachment) && !sending && !uploadingDoc;

  return (
    <div
      className="agent-chat-root"
      style={{
        display: "flex",
        background: "var(--surface-2)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {sidebarOpen && (
        <div style={{ position: "absolute", inset: 0, zIndex: 50 }} onClick={() => setSidebarOpen(false)}>
          <div
            style={{
              width: 280,
              height: "100%",
              background: "var(--surface)",
              borderRight: "1px solid var(--border)",
              overflowY: "auto",
              padding: "16px 0",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "0 16px 12px", borderBottom: "1px solid var(--border)" }}>
              <button
                type="button"
                onClick={newChat}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  background: "linear-gradient(135deg,#6366f1,#4f46e5)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 9,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                + New Chat
              </button>
            </div>
            <div style={{ padding: "12px 8px 0" }}>
              {sessions.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "20px 0" }}>
                  No previous chats
                </p>
              ) : (
                sessions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => loadSession(s.id)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      background: s.id === sessionId ? "rgba(14,165,233,0.12)" : "transparent",
                      border: "none",
                      borderRadius: 8,
                      cursor: "pointer",
                      marginBottom: 2,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: s.id === sessionId ? "#0ea5e9" : "var(--text)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s.title}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      {s._count.messages} messages
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <header className="agent-header">
          <Link href={backHref} className="agent-header-back" aria-label="Back to agents">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <button
            type="button"
            className="agent-header-btn"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-expanded={sidebarOpen}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="agent-header-btn-label">History</span>
          </button>

          <span className="agent-header-avatar">{agent.avatar}</span>
          <div className="agent-header-id">
            <div className="agent-header-name">{agent.name}</div>
            {/* A chip, not a second line of grey text — it reads as metadata
                rather than as a subtitle competing with the agent's name. */}
            <span className="agent-model-chip">
              <span className="agent-model-dot" aria-hidden />
              {modelLabel}
            </span>
          </div>

          <button type="button" className="agent-header-btn agent-header-new" onClick={newChat}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span className="agent-header-btn-label">New Chat</span>
          </button>
        </header>

        <div
          ref={scrollerRef}
          onScroll={onScroll}
          className="agent-scroller"
        >
          {messages.length === 0 ? (
            <div className="agent-empty">
              <div className="agent-empty-avatar">{agent.avatar}</div>
              <h2 className="agent-empty-name">{agent.name}</h2>
              <p className="agent-empty-desc">{agent.description}</p>
              {/* Only rendered when this agent actually has prompts written for
                  it. There is no generic fallback on purpose: "Analyse a stock"
                  under Earnings Decoder would burn the user's first turn. */}
              {(agent.starterPrompts?.length ?? 0) > 0 && (
                <div className="agent-starters">
                  {agent.starterPrompts!.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="agent-starter"
                      onClick={() => void send(prompt)}
                      disabled={sending}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}

              <p className="agent-empty-hint">
                Ask anything · or attach a PDF / Word doc with 📎
              </p>
            </div>
          ) : (
            /* Assistant turns are full-width blocks, not bubbles. A 75%-wide
               bordered bubble is fine for a sentence, but these agents answer
               with headings, tables and multi-paragraph analysis, and squeezing
               that into a chat bubble is most of why the transcript was hard to
               read. Only the user's own short turns stay bubbled — which also
               makes it obvious at a glance who said what. */
            <div className="agent-thread">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="agent-turn agent-turn--user">
                    <div className="agent-user-bubble">{m.content}</div>
                    <span className="agent-user-avatar" title={userName ?? "You"}>
                      {userAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={userAvatar} alt={userName ?? "You"} />
                      ) : (
                        userInitials(userName)
                      )}
                    </span>
                  </div>
                ) : (
                  <div key={i} className="agent-turn agent-turn--model">
                    <div className="agent-turn-head">
                      <span className="agent-turn-avatar">{agent.avatar}</span>
                      <span className="agent-turn-name">{agent.name}</span>
                      {!m.streaming && m.content ? <CopyButton text={m.content} /> : null}
                    </div>
                    <div className="agent-turn-body">
                      {m.streaming && !m.content ? (
                        // Nothing has streamed back yet — show that it's thinking
                        // rather than an empty bubble with a stray ellipsis.
                        <span className="agent-typing" aria-label={`${agent.name} is typing`}>
                          <span />
                          <span />
                          <span />
                        </span>
                      ) : (
                        <>
                          <AgentMarkdown text={m.content} />
                          {m.streaming && <span className="agent-caret" aria-hidden />}
                        </>
                      )}
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </div>

        <div className="agent-footer">
          {/* Only when the reader has scrolled away — the transcript no longer
              drags them back down on every token, so there has to be a way
              back. */}
          {!pinned && messages.length > 0 && (
            <button
              type="button"
              className="agent-jump"
              onClick={() => scrollToBottom(true)}
              aria-label="Jump to latest message"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M19 12l-7 7-7-7" />
              </svg>
              Latest
            </button>
          )}
          <div className="agent-col">
            <DocumentAttachChip
              docAttachment={docAttachment}
              uploadingDoc={uploadingDoc}
              docError={docError}
              onClear={clearDoc}
            />
            {/* Attach, textarea and send share one rounded container so the
                composer reads as a single control rather than three floating
                boxes. The textarea drops its own border to avoid a box in a box. */}
            <div className="agent-composer">
              <DocumentAttachButton
                fileRef={fileRef}
                disabled={sending}
                uploadingDoc={uploadingDoc}
                onPick={onPickDocument}
              />
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder={
                  docAttachment ? `Ask about ${docAttachment.fileName}…` : `Message ${agent.name}…`
                }
                rows={1}
                disabled={sending || uploadingDoc}
                className="agent-composer-input"
                style={{
                  maxHeight: 200,
                  color: sending || uploadingDoc ? "var(--text-muted)" : "var(--text)",
                }}
                onInput={(e) => {
                  const t = e.currentTarget;
                  t.style.height = "auto";
                  t.style.height = Math.min(t.scrollHeight, 200) + "px";
                }}
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={!canSend}
                className="agent-composer-send"
                aria-label="Send message"
                style={{
                  background: canSend ? "linear-gradient(135deg,#6366f1,#4f46e5)" : "var(--surface-2)",
                  cursor: canSend ? "pointer" : "not-allowed",
                }}
              >
                {sending ? (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="2"
                    style={{ animation: "spin 1s linear infinite" }}
                  >
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
                  </svg>
                ) : (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={canSend ? "#fff" : "#94a3b8"}
                    strokeWidth="2.5"
                  >
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          {/* Only on the empty state. Once you are reading answers this line is
              just a permanent strip of chrome under every reply, and the same
              three facts are already on the welcome card above. */}
          {messages.length === 0 && (
            <p className="agent-col agent-composer-hint">
              📎 PDF / Word on every assistant · Enter to send · Powered by {modelLabel}
            </p>
          )}
        </div>
      </div>
      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
