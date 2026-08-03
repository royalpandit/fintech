"use client";

import { useCallback, useEffect, useState } from "react";
import { PROFESSIONAL_TYPES } from "@/lib/professional-types";
import {
  CAPABILITY_CATEGORIES,
  CAPABILITY_META,
  CAPABILITY_PRESETS,
  type Capability,
} from "@/lib/capabilities";

type Row = {
  capability: Capability;
  allowed: boolean;
  defaultAllowed: boolean;
  changed: boolean;
};

function Switch({
  on,
  disabled,
  onClick,
}: {
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 40,
        height: 22,
        borderRadius: 999,
        border: "none",
        background: on ? "var(--primary, #0ea5e9)" : "var(--border)",
        position: "relative",
        cursor: disabled ? "wait" : "pointer",
        transition: "background 0.15s ease",
        flexShrink: 0,
        padding: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: on ? 20 : 2,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.15s ease",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        }}
      />
    </button>
  );
}

export default function ProfessionalPermissions() {
  const [type, setType] = useState<string>(PROFESSIONAL_TYPES[0].value);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [preset, setPreset] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async (t: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/admin/permissions?type=${t}`);
      const j = await res.json();
      if (j.status === false) {
        setError(j.error || "Failed to load permissions");
        setRows([]);
      } else {
        setRows(j.rows ?? []);
      }
    } catch {
      setError(
        "Could not reach the permissions API. If the schema just changed, restart the dev server.",
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(type);
  }, [type, load]);

  async function toggle(capability: Capability, allowed: boolean) {
    setRows((prev) =>
      prev.map((r) =>
        r.capability === capability
          ? { ...r, allowed, changed: allowed !== r.defaultAllowed }
          : r,
      ),
    );
    const res = await fetch("/api/v1/admin/permissions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, capability, allowed }),
    });
    const j = await res.json();
    if (j.rows) setRows(j.rows);
  }

  async function applyPreset() {
    if (!preset) return;
    setBusy(true);
    try {
      const res = await fetch("/api/v1/admin/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, preset }),
      });
      const j = await res.json();
      if (j.rows) setRows(j.rows);
    } finally {
      setBusy(false);
    }
  }

  async function resetType() {
    if (!confirm("Reset this professional to the default permissions?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/admin/permissions?type=${type}`, {
        method: "DELETE",
      });
      const j = await res.json();
      if (j.rows) setRows(j.rows);
    } finally {
      setBusy(false);
    }
  }

  const changedCount = rows.filter((r) => r.changed).length;
  const activeLabel =
    PROFESSIONAL_TYPES.find((p) => p.value === type)?.label ?? type;

  return (
    <section>
      <div style={{ marginBottom: 18 }}>
        <h1 className="page-title">Roles &amp; Permissions</h1>
        <p className="page-subtitle">
          Enable or disable features per professional type. Changes apply
          immediately across the platform. A dot marks a setting that differs
          from the recommended default.
        </p>
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "flex-end",
          marginBottom: 18,
        }}
      >
        <label style={{ display: "grid", gap: 5 }}>
          <span style={fieldLabel}>Professional</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            style={{ ...control, minWidth: 260, fontWeight: 600 }}
          >
            {PROFESSIONAL_TYPES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 5 }}>
          <span style={fieldLabel}>Apply preset</span>
          <div style={{ display: "flex", gap: 6 }}>
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
              style={{ ...control, minWidth: 160 }}
            >
              <option value="">Choose…</option>
              {CAPABILITY_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={applyPreset}
              disabled={!preset || busy}
              className="btn-primary"
              style={{
                padding: "0 16px",
                fontSize: 13,
                fontWeight: 700,
                opacity: !preset || busy ? 0.5 : 1,
              }}
            >
              Apply
            </button>
          </div>
        </label>

        <div style={{ flex: 1 }} />

        {/* Badge + reset grouped so they share the same baseline as the button */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, height: 40 }}>
          {changedCount > 0 && (
            <span
              title={`${changedCount} setting${changedCount > 1 ? "s" : ""} differ from the recommended default`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "6px 12px",
                borderRadius: 999,
                background: "rgba(245,158,11,0.12)",
                border: "1px solid rgba(245,158,11,0.35)",
                color: "#b45309",
                fontSize: 12,
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#f59e0b",
                  flexShrink: 0,
                }}
              />
              {changedCount} changed
            </span>
          )}
          <button
            type="button"
            onClick={resetType}
            disabled={busy || changedCount === 0}
            style={{
              padding: "0 14px",
              height: 40,
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text)",
              cursor: busy || changedCount === 0 ? "not-allowed" : "pointer",
              opacity: changedCount === 0 ? 0.5 : 1,
            }}
          >
            Reset to default
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: "12px 14px",
            marginBottom: 16,
            borderRadius: 10,
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.35)",
            color: "#b91c1c",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
          Loading permissions…
        </p>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {CAPABILITY_CATEGORIES.map((category) => {
            const catRows = rows.filter(
              (r) => CAPABILITY_META[r.capability].category === category,
            );
            if (catRows.length === 0) return null;
            return (
              <article className="card" key={category}>
                <h3
                  style={{
                    margin: "0 0 12px",
                    fontSize: 13,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    color: "var(--text-muted)",
                  }}
                >
                  {category}
                </h3>
                <div style={{ display: "grid", gap: 2 }}>
                  {catRows.map((r) => (
                    <div
                      key={r.capability}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 4px",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <Switch
                        on={r.allowed}
                        disabled={busy}
                        onClick={() => toggle(r.capability, !r.allowed)}
                      />
                      <span
                        style={{
                          fontSize: 14,
                          color: "var(--text)",
                          fontWeight: 500,
                        }}
                      >
                        {CAPABILITY_META[r.capability].label}
                      </span>
                      {r.changed && (
                        <span
                          title={`Default: ${r.defaultAllowed ? "on" : "off"}`}
                          style={{
                            fontSize: 11,
                            color: "#b45309",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: "#f59e0b",
                            }}
                          />
                          changed
                        </span>
                      )}
                      <span style={{ flex: 1 }} />
                      <span
                        style={{ fontSize: 11, color: "var(--text-muted)" }}
                      >
                        {r.allowed ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p style={{ marginTop: 16, fontSize: 11.5, color: "var(--text-muted)" }}>
        Editing <strong>{activeLabel}</strong>. Every change is recorded in the
        audit log.
      </p>
    </section>
  );
}

const fieldLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const control: React.CSSProperties = {
  height: 40,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 13,
  outline: "none",
};
