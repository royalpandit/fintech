"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DocumentAttachButton,
  DocumentAttachChip,
  useDocumentAttach,
} from "@/components/agents/document-attach";

type Agent = { id: number; name: string; avatar: string; description: string };
type Msg = { role: "user" | "model"; content: string };

// Hidden on staff consoles. Also requires a logged-in user / advisor / admin
// (see `loggedIn` below) so landing, login, and register stay bubble-free for guests.
//
// The agent sections are hidden for a different reason: this bubble IS an agent
// chat, so floating it over a full-screen agent chat gave you two chat inputs on
// one screen, with the bubble sitting on top of the real composer. Both the
// browser and the [id] chat pages are covered — on the browser your next click
// is to pick an agent anyway.
const HIDDEN_PREFIXES = [
  "/super-admin",
  "/admin",
  "/moderator",
  "/login",
  "/register",
  "/user/lab/agents",
  "/advisor/agents",
];
const CHAT_ROLES = new Set(["user", "advisor", "admin", "super_admin"]);

const BUBBLE_SIZE = 56;

// Keep the draggable bubble fully on-screen (8px margin from every edge).
function clampBubble(x: number, y: number) {
  const m = 8;
  const maxX = window.innerWidth - BUBBLE_SIZE - m;
  const maxY = window.innerHeight - BUBBLE_SIZE - m;
  return { x: Math.min(Math.max(m, x), maxX), y: Math.min(Math.max(m, y), maxY) };
}

export default function ChatWidget() {
  const pathname = usePathname();
  const pathHidden = HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));

  const [agent, setAgent] = useState<Agent | null>(null);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const sessionRef = useRef<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const {
    fileRef,
    docAttachment,
    uploadingDoc,
    docError,
    clearDoc,
    onPickDocument,
    buildDocMessage,
  } = useDocumentAttach();

  const hidden = pathHidden || loggedIn !== true;

  // Draggable launcher position (persisted). null until measured on the client.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const upd = () => setIsMobile(mq.matches);
    upd();
    mq.addEventListener("change", upd);
    return () => mq.removeEventListener("change", upd);
  }, []);

  // Restore a saved position, else default to bottom-right — lifted above the
  // mobile bottom nav bar so it never covers the tabs.
  useEffect(() => {
    if (hidden) return;
    try {
      const saved = localStorage.getItem("chat-bubble-pos");
      if (saved) {
        const p = JSON.parse(saved);
        if (typeof p?.x === "number" && typeof p?.y === "number") {
          setPos(clampBubble(p.x, p.y));
          return;
        }
      }
    } catch {
      /* ignore */
    }
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    const bottomGap = mobile ? 84 : 24; // clear the mobile bottom tab bar
    setPos(
      clampBubble(window.innerWidth - BUBBLE_SIZE - 20, window.innerHeight - BUBBLE_SIZE - bottomGap),
    );
  }, [hidden]);

  // Keep it on-screen when the viewport resizes / rotates.
  useEffect(() => {
    const onResize = () => setPos((p) => (p ? clampBubble(p.x, p.y) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Only show the bubble when a user / advisor / admin session is active.
  useEffect(() => {
    let alive = true;
    fetch("/api/v1/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return;
        const role = j?.user?.role as string | undefined;
        setLoggedIn(Boolean(role && CHAT_ROLES.has(role)));
      })
      .catch(() => {
        if (alive) setLoggedIn(false);
      });
    return () => {
      alive = false;
    };
  }, [pathname]);

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

  // Wait for auth check so the bubble never flashes on public pages.
  if (loggedIn === null || hidden || !agent) return null;

  async function send() {
    const typed = input.trim();
    if ((!typed && !docAttachment) || sending || uploadingDoc) return;

    const { display, messageForModel } = buildDocMessage(typed);

    setInput("");
    clearDoc();
    setMessages((m) => [...m, { role: "user", content: display }, { role: "model", content: "" }]);
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
        body: JSON.stringify({ message: messageForModel, sessionId: sessionRef.current || undefined }),
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

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = {
      sx: e.clientX,
      sy: e.clientY,
      ox: e.clientX - rect.left,
      oy: e.clientY - rect.top,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const d = dragRef.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6) d.moved = true;
    if (d.moved) setPos(clampBubble(e.clientX - d.ox, e.clientY - d.oy));
  }
  function onPointerUp() {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (d.moved) {
      // Persist the dragged position.
      setPos((p) => {
        if (p) {
          try {
            localStorage.setItem("chat-bubble-pos", JSON.stringify(p));
          } catch {
            /* ignore */
          }
        }
        return p;
      });
    } else {
      // A tap (no drag) opens the chat.
      setOpen(true);
    }
  }

  return (
    <>
      {/* Launcher bubble — draggable; tap to open */}
      {!open && (
        <button
          type="button"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          aria-label={`Chat with ${agent.name} (drag to move)`}
          title={`Chat with ${agent.name} · drag to move`}
          style={{
            position: "fixed",
            ...(pos ? { left: pos.x, top: pos.y } : { right: 20, bottom: isMobile ? 84 : 24 }),
            width: BUBBLE_SIZE,
            height: BUBBLE_SIZE,
            borderRadius: 999,
            border: "none",
            background: "linear-gradient(135deg,#2563eb,#10b981)",
            color: "#fff",
            fontSize: 26,
            cursor: "grab",
            touchAction: "none",
            userSelect: "none",
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
            bottom: isMobile ? 84 : 22,
            right: 22,
            width: "min(380px, calc(100vw - 32px))",
            height: isMobile ? "calc(100vh - 168px)" : "min(560px, calc(100vh - 100px))",
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
          <div style={{ borderTop: "1px solid var(--border)" }}>
            {(docAttachment || docError || uploadingDoc) ? (
              <div style={{ padding: "8px 12px 0" }}>
                <DocumentAttachChip
                  docAttachment={docAttachment}
                  uploadingDoc={uploadingDoc}
                  docError={docError}
                  onClear={clearDoc}
                />
              </div>
            ) : null}
            <div style={{ display: "flex", gap: 8, padding: 12, alignItems: "center" }}>
              <DocumentAttachButton
                fileRef={fileRef}
                disabled={sending}
                uploadingDoc={uploadingDoc}
                onPick={(f) => void onPickDocument(f)}
                size={40}
              />
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder={docAttachment ? "Add a question about the doc…" : "Type a message…"}
                disabled={sending || uploadingDoc}
                style={{ flex: 1, height: 40, padding: "0 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, outline: "none" }}
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={sending || uploadingDoc || (!input.trim() && !docAttachment)}
                style={{ height: 40, padding: "0 16px", borderRadius: 10, border: "none", background: "var(--accent-blue, #2563eb)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: sending ? "wait" : "pointer", opacity: !input.trim() && !docAttachment ? 0.6 : 1 }}
              >
                Send
              </button>
            </div>
          </div>
          )}
        </div>
      )}
    </>
  );
}
