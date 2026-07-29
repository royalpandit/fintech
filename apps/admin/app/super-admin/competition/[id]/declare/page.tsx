"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Btn, Field, Panel, competitionApi, inputStyle } from "@/components/competition/admin-ui";

type CompetitionData = {
  id: number;
  title: string;
  question?: string | null;
  options: { id: number; label: string }[];
  resultDeclaredAt?: string | null;
  winningOptionId?: number | null;
};

export default function DeclareWinnerPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [data, setData] = useState<CompetitionData | null>(null);
  const [winningOptionId, setWinningOptionId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    competitionApi(`/api/v1/admin/competitions/${id}`).then(async (r) => {
      const j = await r.json();
      if (j.ok) {
        setData(j.data);
        if (j.data.winningOptionId) setWinningOptionId(String(j.data.winningOptionId));
      }
      setLoading(false);
    });
  }, [id]);

  async function declareWinner() {
    if (!winningOptionId) {
      setError("Select the winning answer");
      return;
    }
    if (!confirm("Declare this winner? Reputation points will be distributed to all participants.")) {
      return;
    }
    setSaving(true);
    setError("");
    const r = await competitionApi(`/api/v1/admin/competitions/${id}/declare-winner`, {
      method: "POST",
      body: JSON.stringify({ winningOptionId: Number(winningOptionId) }),
    });
    const j = await r.json();
    setSaving(false);
    if (!j.ok) {
      setError(j.error || "Failed to declare winner");
      return;
    }
    router.push("/super-admin/competition/list");
  }

  if (loading) return <p>Loading…</p>;
  if (!data) return <p>Competition not found.</p>;

  if (data.resultDeclaredAt) {
    return (
      <Panel title="Result Already Declared">
        <p>Winner was declared on {new Date(data.resultDeclaredAt).toLocaleString()}.</p>
        <Link href="/super-admin/competition/list">
          <Btn variant="ghost">Back to list</Btn>
        </Link>
      </Panel>
    );
  }

  return (
    <Panel title={`Declare Winner — ${data.title}`}>
      <p style={{ marginBottom: 16, color: "var(--text-muted)" }}>
        Section 8 — After the competition ends, select the winning answer. The system will
        automatically update reputation scores for all participants.
      </p>

      {data.question ? (
        <Field label="Question">
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{data.question}</p>
        </Field>
      ) : null}

      <div style={{ marginTop: 16 }}>
        <Field label="Winning Answer *">
          <select
            style={inputStyle}
            value={winningOptionId}
            onChange={(e) => setWinningOptionId(e.target.value)}
          >
            <option value="">Select winning answer…</option>
            {data.options.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {error ? <p style={{ color: "#ef4444", fontSize: 13, marginTop: 12 }}>{error}</p> : null}

      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        <Btn type="button" disabled={saving} onClick={declareWinner}>
          {saving ? "Processing…" : "Declare Winner"}
        </Btn>
        <Link href="/super-admin/competition/list">
          <Btn type="button" variant="ghost">
            Cancel
          </Btn>
        </Link>
      </div>
    </Panel>
  );
}
