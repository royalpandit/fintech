"use client";

import { useMemo, useState } from "react";
import { ACTIONS, DEFAULT_PERMISSION_MATRIX, FEATURES, type AppUserType, type PermissionAction } from "../lib/rbac";

function hasPermission(
  matrix: typeof DEFAULT_PERMISSION_MATRIX,
  userType: AppUserType,
  featureKey: (typeof FEATURES)[number]["key"],
  action: PermissionAction,
) {
  return matrix[userType][featureKey].includes(action);
}

export default function PermissionMatrix() {
  const [matrix, setMatrix] = useState(DEFAULT_PERMISSION_MATRIX);
  const [activeType, setActiveType] = useState<AppUserType>("advisor");

  const summary = useMemo(() => {
    return FEATURES.map((feature) => {
      const count = matrix[activeType][feature.key].length;
      return `${feature.label}: ${count}`;
    }).join(" | ");
  }, [activeType, matrix]);

  const togglePermission = (
    userType: AppUserType,
    featureKey: (typeof FEATURES)[number]["key"],
    action: PermissionAction,
  ) => {
    setMatrix((prev) => {
      const has = prev[userType][featureKey].includes(action);
      const nextActions = has
        ? prev[userType][featureKey].filter((existing) => existing !== action)
        : [...prev[userType][featureKey], action];

      return {
        ...prev,
        [userType]: {
          ...prev[userType],
          [featureKey]: nextActions,
        },
      };
    });
  };

  return (
    <section>
      <h1 className="page-title">Role & Permissions</h1>
      <p className="page-subtitle">
        Super Admin can assign feature-level permissions separately for advisor and user roles.
      </p>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        {(["advisor", "user"] as AppUserType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setActiveType(type)}
            style={{
              border: "1px solid var(--border)",
              background: activeType === type ? "var(--primary)" : "var(--surface)",
              color: activeType === type ? "white" : "var(--text)",
              borderRadius: 10,
              padding: "8px 12px",
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {type}
          </button>
        ))}
      </div>

      <p className="page-subtitle" style={{ marginTop: 10 }}>
        {summary}
      </p>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Feature</th>
                {ACTIONS.map((action) => (
                  <th key={action} style={{ textTransform: "capitalize" }}>
                    {action}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((feature) => (
                <tr key={feature.key}>
                  <td>{feature.label}</td>
                  {ACTIONS.map((action) => {
                    const checked = hasPermission(matrix, activeType, feature.key, action);
                    return (
                      <td key={`${feature.key}-${action}`}>
                        <input
                          className="toggle"
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePermission(activeType, feature.key, action)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

