"use client";

import { useEffect, useMemo, useState } from "react";

type Field = { key: string; label: string; placeholder?: string; secret?: boolean };

type IntegrationDef = {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  usedIn: string;
  fields: Field[];
};

type Connection = {
  connected: boolean;
  config: Record<string, string>;
  updatedAt: string;
  usedIn?: string;
};

// Known integrations the platform can connect. Adding a new one from the modal
// creates a custom entry alongside these.
const REGISTRY: IntegrationDef[] = [
  {
    id: "angelone",
    name: "AngelOne SmartAPI",
    category: "Market Data",
    description: "Live NSE/BSE & F&O quotes, historical candles, and symbol search.",
    icon: "📈",
    usedIn: "Markets · Watchlist · Charts · Stock search",
    fields: [
      { key: "apiKey", label: "API Key", secret: true },
      { key: "clientId", label: "Client ID" },
      { key: "totpSecret", label: "TOTP Secret", secret: true },
    ],
  },
  {
    id: "razorpay",
    name: "Razorpay",
    category: "Payments",
    description: "Collect subscriptions, one-time unlocks, and course payments.",
    icon: "💳",
    usedIn: "Subscriptions · Post unlocks · Course purchases · Featured placement",
    fields: [
      { key: "keyId", label: "Key ID" },
      { key: "keySecret", label: "Key Secret", secret: true },
      { key: "webhookSecret", label: "Webhook Secret", secret: true },
    ],
  },
  {
    id: "gemini",
    name: "Google Gemini",
    category: "AI",
    description: "AI compliance checks, content moderation, and summaries.",
    icon: "🤖",
    usedIn: "AI Compliance · Post moderation · AI Agents",
    fields: [{ key: "apiKey", label: "API Key", secret: true }],
  },
  {
    id: "smtp",
    name: "Email (SMTP)",
    category: "Messaging",
    description: "Transactional email — verifications, receipts, alerts.",
    icon: "✉️",
    usedIn: "Email verification · Receipts · Password reset · Alerts",
    fields: [
      { key: "host", label: "SMTP Host", placeholder: "smtp.example.com" },
      { key: "port", label: "Port", placeholder: "587" },
      { key: "username", label: "Username" },
      { key: "password", label: "Password", secret: true },
    ],
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    category: "Messaging",
    description: "Broadcasts and OTPs over the WhatsApp Cloud API.",
    icon: "💬",
    usedIn: "Advisor broadcasts · OTP login · Notifications",
    fields: [
      { key: "phoneNumberId", label: "Phone Number ID" },
      { key: "accessToken", label: "Access Token", secret: true },
    ],
  },
  {
    id: "s3",
    name: "AWS S3",
    category: "Storage",
    description: "Object storage for media uploads, reports, and course videos.",
    icon: "🗄️",
    usedIn: "Media uploads · Advisor reports · Course videos · Avatars",
    fields: [
      { key: "bucket", label: "Bucket" },
      { key: "region", label: "Region", placeholder: "ap-south-1" },
      { key: "accessKeyId", label: "Access Key ID" },
      { key: "secretAccessKey", label: "Secret Access Key", secret: true },
    ],
  },
];

const STORAGE_KEY = "finuer.integrations.v1";

function loadConnections(): Record<string, Connection> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export default function IntegrationsManager({
  serverConnected = [],
}: {
  // Integration ids the server reports as configured via environment (e.g.
  // AngelOne, Gemini). Presence only — secret VALUES are never sent to the client.
  serverConnected?: string[];
}) {
  const [connections, setConnections] = useState<Record<string, Connection>>({});
  const [custom, setCustom] = useState<IntegrationDef[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [configureId, setConfigureId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [draftUsedIn, setDraftUsedIn] = useState("");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newUsedIn, setNewUsedIn] = useState("");

  const serverSet = useMemo(() => new Set(serverConnected), [serverConnected]);

  useEffect(() => {
    setConnections(loadConnections());
    try {
      setCustom(JSON.parse(window.localStorage.getItem(STORAGE_KEY + ".custom") || "[]"));
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const all = useMemo(() => [...REGISTRY, ...custom], [custom]);

  function persist(next: Record<string, Connection>) {
    setConnections(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function persistCustom(next: IntegrationDef[]) {
    setCustom(next);
    window.localStorage.setItem(STORAGE_KEY + ".custom", JSON.stringify(next));
  }

  const configuring = all.find((i) => i.id === configureId) || null;

  function openConfigure(id: string) {
    const def = all.find((i) => i.id === id);
    setConfigureId(id);
    setDraft(connections[id]?.config ?? {});
    setDraftUsedIn(connections[id]?.usedIn ?? def?.usedIn ?? "");
  }

  function saveConfigure() {
    if (!configuring) return;
    persist({
      ...connections,
      [configuring.id]: {
        connected: true,
        config: draft,
        updatedAt: new Date().toISOString(),
        usedIn: draftUsedIn.trim() || configuring.usedIn,
      },
    });
    setConfigureId(null);
    setDraft({});
    setDraftUsedIn("");
  }

  function disconnect(id: string) {
    const next = { ...connections };
    delete next[id];
    persist(next);
  }

  function addCustom() {
    const name = newName.trim();
    if (!name) return;
    const id = "custom-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    if (all.some((i) => i.id === id)) return;
    persistCustom([
      ...custom,
      {
        id,
        name,
        category: newCategory.trim() || "Custom",
        description: "Custom integration.",
        icon: "🔌",
        usedIn: newUsedIn.trim() || newCategory.trim() || "Custom",
        fields: [
          { key: "apiKey", label: "API Key", secret: true },
          { key: "endpoint", label: "Endpoint URL" },
        ],
      },
    ]);
    setNewName("");
    setNewCategory("");
    setNewUsedIn("");
    setAddOpen(false);
    openConfigure(id);
  }

  function deleteCustom(id: string) {
    persistCustom(custom.filter((i) => i.id !== id));
    const next = { ...connections };
    delete next[id];
    persist(next);
  }

  const connectedIds = new Set<string>(serverConnected);
  for (const [id, c] of Object.entries(connections)) if (c.connected) connectedIds.add(id);
  const connectedCount = connectedIds.size;

  return (
    <article className="card" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>Integrations &amp; Infrastructure</h3>
          <p className="page-subtitle" style={{ margin: "4px 0 0" }}>
            {hydrated ? `${connectedCount} connected` : "…"} · connect the services that power Finuer.
          </p>
        </div>
        <button className="btn-primary" type="button" onClick={() => setAddOpen(true)}>
          + Add Integration
        </button>
      </div>

      <div
        className="grid"
        style={{ marginTop: 14, gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}
      >
        {all.map((it) => {
          const conn = connections[it.id];
          const serverManaged = serverSet.has(it.id);
          const connected = serverManaged || !!conn?.connected;
          const isCustom = it.id.startsWith("custom-");
          const usedIn = conn?.usedIn ?? it.usedIn;
          return (
            <article
              key={it.id}
              className="card dash-tile"
              style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 24 }}>{it.icon}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 700 }}>{it.name}</p>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>{it.category}</p>
                </div>
                {isCustom && (
                  <button
                    type="button"
                    onClick={() => deleteCustom(it.id)}
                    aria-label={`Delete ${it.name}`}
                    title="Delete integration"
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#c5221f",
                      cursor: "pointer",
                      fontSize: 16,
                      lineHeight: 1,
                      padding: 2,
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", flex: 1 }}>
                {it.description}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  color: "var(--accent-blue, #2563eb)",
                  fontWeight: 600,
                }}
              >
                Used in: <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>{usedIn}</span>
              </p>
              {serverManaged ? (
                <p style={{ margin: 0, fontSize: 10, color: "var(--text-muted)" }}>
                  Configured via server environment
                </p>
              ) : (
                connected &&
                conn?.updatedAt && (
                  <p style={{ margin: 0, fontSize: 10, color: "var(--text-muted)" }}>
                    Connected {new Date(conn.updatedAt).toLocaleDateString()}
                  </p>
                )
              )}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span
                  className={`tag ${connected ? "success" : ""}`}
                  style={connected ? undefined : { color: "var(--text-muted)" }}
                >
                  {connected ? "● Connected" : "Not connected"}
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  {connected && !serverManaged && (
                    <button type="button" onClick={() => disconnect(it.id)} style={ghostBtn}>
                      Disconnect
                    </button>
                  )}
                  {isCustom && (
                    <button
                      type="button"
                      onClick={() => deleteCustom(it.id)}
                      style={{ ...ghostBtn, color: "#c5221f", borderColor: "#fad2cf" }}
                    >
                      Delete
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openConfigure(it.id)}
                    style={{ ...ghostBtn, color: "#047857", borderColor: "var(--border)" }}
                  >
                    {connected ? "Configure" : "Connect"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Configure modal */}
      {configuring && (
        <Modal onClose={() => setConfigureId(null)} title={`${configuring.name}`}>
          <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--text-muted)" }}>
            {configuring.description}
          </p>
          {serverSet.has(configuring.id) && (
            <p
              style={{
                fontSize: 12,
                margin: "0 0 14px",
                padding: "8px 10px",
                borderRadius: 8,
                background: "var(--primary-soft)",
                color: "#047857",
                fontWeight: 600,
              }}
            >
              ● Connected via server environment. Credentials are managed in the deployment config,
              not here — you can still edit where it&apos;s used below.
            </p>
          )}
          {configuring.fields.map((f) => (
            <label key={f.key} style={{ display: "block", marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>{f.label}</span>
              <input
                className="input"
                type={f.secret ? "password" : "text"}
                placeholder={serverSet.has(configuring.id) ? "•••••••• (from environment)" : f.placeholder}
                value={draft[f.key] ?? ""}
                onChange={(e) => setDraft((p) => ({ ...p, [f.key]: e.target.value }))}
                style={{ width: "100%", marginTop: 6 }}
              />
            </label>
          ))}
          <label style={{ display: "block", marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
              Used in <span style={{ fontWeight: 400 }}>(where this powers the app)</span>
            </span>
            <input
              className="input"
              placeholder="e.g. Markets · Watchlist · Charts"
              value={draftUsedIn}
              onChange={(e) => setDraftUsedIn(e.target.value)}
              style={{ width: "100%", marginTop: 6 }}
            />
          </label>
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 14px" }}>
            Saved securely in this browser for now. Server-side secret storage lands with the config API.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={() => setConfigureId(null)} style={{ ...ghostBtn, flex: 1, padding: 12 }}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={saveConfigure} style={{ flex: 1 }}>
              Save &amp; Connect
            </button>
          </div>
        </Modal>
      )}

      {/* Add integration modal */}
      {addOpen && (
        <Modal onClose={() => setAddOpen(false)} title="Add Integration">
          <label style={{ display: "block", marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Name</span>
            <input
              className="input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Twilio"
              style={{ width: "100%", marginTop: 6 }}
            />
          </label>
          <label style={{ display: "block", marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Category</span>
            <input
              className="input"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="e.g. Messaging"
              style={{ width: "100%", marginTop: 6 }}
            />
          </label>
          <label style={{ display: "block", marginBottom: 16 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
              Used in <span style={{ fontWeight: 400 }}>(where it powers the app)</span>
            </span>
            <input
              className="input"
              value={newUsedIn}
              onChange={(e) => setNewUsedIn(e.target.value)}
              placeholder="e.g. SMS OTP · Alerts"
              style={{ width: "100%", marginTop: 6 }}
            />
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={() => setAddOpen(false)} style={{ ...ghostBtn, flex: 1, padding: 12 }}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={addCustom}
              disabled={!newName.trim()}
              style={{ flex: 1, opacity: newName.trim() ? 1 : 0.5 }}
            >
              Add &amp; Configure
            </button>
          </div>
        </Modal>
      )}
    </article>
  );
}

const ghostBtn: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
};

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 200,
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 440,
          background: "var(--surface)",
          borderRadius: 14,
          border: "1px solid var(--border)",
          padding: 24,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700, color: "var(--text)" }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}
