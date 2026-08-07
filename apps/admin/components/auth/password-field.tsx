"use client";

import { useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";

export default function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete = "current-password",
  marginBottom = 20,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  marginBottom?: number;
}) {
  const [show, setShow] = useState(false);
  return (
    <>
      <label className="theme-label" htmlFor={id}>
        {label}
      </label>
      <div style={{ position: "relative", marginBottom }}>
        <input
          id={id}
          className="theme-input"
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
          style={{ width: "100%", paddingRight: 44, marginBottom: 0 }}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          tabIndex={-1}
          style={{
            position: "absolute",
            right: 10,
            top: "50%",
            transform: "translateY(-50%)",
            border: "none",
            background: "transparent",
            color: "var(--text-muted)",
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
            padding: 4,
          }}
        >
          {show ? <FiEye size={18} /> : <FiEyeOff size={18} />}
        </button>
      </div>
    </>
  );
}
