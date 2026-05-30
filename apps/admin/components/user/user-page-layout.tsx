import Link from "next/link";
import type { ReactNode } from "react";

/** Matches Advisors page: full-width section inside `.us-content` */
export function UserPageSection({ children }: { children: ReactNode }) {
  return <section className="user-page-section">{children}</section>;
}

export function UserPageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="user-page-header">
      <h1 className="user-page-title">{title}</h1>
      {subtitle ? <p className="user-page-subtitle">{subtitle}</p> : null}
    </div>
  );
}

/** Same grid as Advisors: auto-fill minmax(280px, 1fr), gap 14 */
export function UserPageGrid({ children }: { children: ReactNode }) {
  return <div className="user-page-grid">{children}</div>;
}

export function UserPageStatsGrid({ children }: { children: ReactNode }) {
  return <div className="user-page-stats">{children}</div>;
}

export function UserPageStatCard({
  label,
  value,
  color = "#0f172a",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <article className="user-page-stat-card">
      <p className="user-page-stat-label">{label}</p>
      <p className="user-page-stat-value" style={{ color }}>
        {value}
      </p>
    </article>
  );
}

export function UserPageCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <article className={`user-page-card ${className}`.trim()}>{children}</article>;
}

export function UserPageBackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="user-page-back-link">
      {children}
    </Link>
  );
}
