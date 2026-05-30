"use client";

import type { PostAccessType } from "@/lib/post-access";

export default function PostAccessSelector({
  value,
  onChange,
  variant = "default",
}: {
  value: PostAccessType;
  onChange: (v: PostAccessType) => void;
  variant?: "default" | "composer" | "form";
}) {
  const cls =
    variant === "composer"
      ? "sf-post-access"
      : variant === "form"
        ? "post-access-form"
        : "post-access-selector";

  return (
    <fieldset className={cls}>
      <legend className="post-access-legend">Post Access *</legend>
      <div className="post-access-options">
        <label className={`post-access-option${value === "free" ? " active" : ""}`}>
          <input
            type="radio"
            name="postAccessType"
            value="free"
            checked={value === "free"}
            onChange={() => onChange("free")}
          />
          <span className="post-access-option-label">Free</span>
          <span className="post-access-option-hint">Visible to everyone</span>
        </label>
        <label className={`post-access-option${value === "paid" ? " active premium" : ""}`}>
          <input
            type="radio"
            name="postAccessType"
            value="paid"
            checked={value === "paid"}
            onChange={() => onChange("paid")}
          />
          <span className="post-access-option-label">Paid</span>
          <span className="post-access-option-hint">Premium — unlock required</span>
        </label>
      </div>
    </fieldset>
  );
}
