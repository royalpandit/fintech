import { notFound } from "next/navigation";

const allowedModules = new Set([
  "users",
  "advisors",
  "market-posts",
  "community",
  "reports",
  "ai-compliance",
  "analytics",
  "payments",
  "courses",
  "notifications",
  "audit-logs",
  "settings",
]);

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function GenericSuperAdminModulePage({ params }: { params: { module: string } }) {
  const moduleSlug = params.module;

  if (!allowedModules.has(moduleSlug)) {
    notFound();
  }

  if (moduleSlug === "users") {
    notFound();
  }

  const title = titleFromSlug(moduleSlug);

  return (
    <section>
      <h1 className="page-title">{title}</h1>
      <p className="page-subtitle">
        {title} module scaffold is ready. This route is wired for exact Figma section implementation.
      </p>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 16 }}>
        <article className="card">
          <h3 style={{ marginTop: 0 }}>Screen Status</h3>
          <p style={{ marginBottom: 6 }}>
            UI foundation for <strong>{title}</strong> is active.
          </p>
          <span className="tag">In progress</span>
        </article>

        <article className="card">
          <h3 style={{ marginTop: 0 }}>Backend Integration</h3>
          <p style={{ marginBottom: 6 }}>
            Connect this module with NestJS endpoints once API contracts are finalized.
          </p>
          <span className="tag success">Ready for API mapping</span>
        </article>
      </div>
    </section>
  );
}

