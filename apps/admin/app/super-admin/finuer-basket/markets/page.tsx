"use client";

import { FormEvent, useEffect, useState } from "react";
import { Btn, Field, Panel, finuerBasketApi, inputStyle, tableStyle, tdStyle, thStyle } from "@/components/finuer-basket/admin-ui";

type Market = { id: number; name: string; status: string };

export default function MarketsAdminPage() {
  const [rows, setRows] = useState<Market[]>([]);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("active");
  const [editId, setEditId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const r = await finuerBasketApi("/api/v1/admin/markets");
    const j = await r.json();
    if (j.ok) setRows(j.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setName("");
    setStatus("active");
    setEditId(null);
    setError("");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    const r = await finuerBasketApi(editId ? `/api/v1/admin/markets/${editId}` : "/api/v1/admin/markets", {
      method: editId ? "PUT" : "POST",
      body: JSON.stringify({ name, status }),
    });
    const j = await r.json();
    if (!j.ok) {
      setError(j.error || "Failed");
      return;
    }
    resetForm();
    load();
  }

  async function remove(id: number) {
    if (!confirm("Delete this market?")) return;
    const r = await finuerBasketApi(`/api/v1/admin/markets/${id}`, { method: "DELETE" });
    const j = await r.json();
    if (!j.ok) alert(j.error || "Delete failed");
    else load();
  }

  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 320px" }}>
      <Panel title="Markets">
        {loading ? (
          <p>Loading…</p>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                {["Name", "Status", "Actions"].map((h) => (
                  <th key={h} style={thStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td style={tdStyle}>{row.name}</td>
                  <td style={tdStyle}>{row.status}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Btn
                        variant="ghost"
                        onClick={() => {
                          setEditId(row.id);
                          setName(row.name);
                          setStatus(row.status);
                        }}
                      >
                        Edit
                      </Btn>
                      <Btn variant="danger" onClick={() => remove(row.id)}>
                        Delete
                      </Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel title={editId ? "Edit Market" : "Add Market"}>
        <form onSubmit={onSubmit}>
          <Field label="Name *">
            <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Status">
            <select style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
          {error ? <p style={{ color: "#ef4444", fontSize: 12 }}>{error}</p> : null}
          <div style={{ display: "flex", gap: 8 }}>
            <Btn type="submit">{editId ? "Update" : "Add Market"}</Btn>
            {editId ? <Btn variant="ghost" onClick={resetForm}>Cancel</Btn> : null}
          </div>
        </form>
      </Panel>
    </div>
  );
}
