"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/toast";

type Values = {
  platformName: string;
  supportEmail: string;
  timezone: string;
  locale: string;
};

const STORAGE_KEY = "finuer.settings.general.v1";

export default function GeneralConfigForm({ defaults }: { defaults: Values }) {
  const { show } = useToast();
  const [values, setValues] = useState<Values>(defaults);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setValues({ ...defaults, ...JSON.parse(saved) });
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k: keyof Values, v: string) => setValues((p) => ({ ...p, [k]: v }));

  function save() {
    setSaving(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
      show("General settings saved");
    } catch {
      show("Couldn't save settings", "error");
    } finally {
      setSaving(false);
    }
  }

  const fields: { key: keyof Values; label: string }[] = [
    { key: "platformName", label: "Platform Name" },
    { key: "supportEmail", label: "Support Email" },
    { key: "timezone", label: "Default Timezone" },
    { key: "locale", label: "Locale" },
  ];

  return (
    <>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 14 }}>
        {fields.map((f) => (
          <label key={f.key}>
            <p className="metric-label" style={{ margin: "0 0 6px" }}>
              {f.label}
            </p>
            <input
              className="input"
              value={values[f.key]}
              onChange={(e) => set(f.key, e.target.value)}
            />
          </label>
        ))}
      </div>
      <button className="btn-primary" style={{ marginTop: 14 }} type="button" onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save General Settings"}
      </button>
    </>
  );
}
