import type { CSSProperties } from "react";

/**
 * Advisor / user avatar. Renders the uploaded profile image when there is one
 * and falls back to the name's initials otherwise. Every user-facing surface
 * (feed, trades, advisor cards, chat) should go through this so an advisor who
 * uploads a picture sees it everywhere — not just on their own profile page.
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ProfileAvatar({
  src,
  name,
  size = 42,
  radius,
  fontSize,
  style,
  className,
}: {
  src?: string | null;
  name: string;
  size?: number;
  radius?: number;
  fontSize?: number;
  style?: CSSProperties;
  className?: string;
}) {
  const base: CSSProperties = {
    width: size,
    height: size,
    borderRadius: radius ?? Math.round(size * 0.28),
    flexShrink: 0,
    ...style,
  };

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={className}
        style={{ ...base, objectFit: "cover", display: "block", background: "var(--surface-2)" }}
      />
    );
  }

  return (
    <span
      className={className}
      style={{
        ...base,
        background: "linear-gradient(135deg, rgba(14,165,233,0.13), rgba(16,185,129,0.13))",
        color: "#0ea5e9",
        display: "grid",
        placeItems: "center",
        fontSize: fontSize ?? Math.max(10, Math.round(size * 0.32)),
        fontWeight: 600,
      }}
    >
      {getInitials(name)}
    </span>
  );
}
