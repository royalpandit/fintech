import Link from "next/link";
import { cookies } from "next/headers";
import { FiSettings, FiUser, FiBell, FiSliders, FiLock } from "react-icons/fi";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import ThemeSettingsField from "@/components/theme/theme-settings-field";
import NotificationPreferences from "@/components/user/notification-preferences";
import AccountForm from "./account-form";

export const dynamic = "force-dynamic";

export default async function UserSettingsPage() {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);

  if (!auth) {
    return (
      <section>
        <article
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: 48,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12, color: "var(--text-muted)", display: "flex", justifyContent: "center" }}>
            <FiSettings size={36} />
          </div>
          <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600 }}>
            Sign in to manage settings
          </h2>
          <Link
            href="/register"
            style={{
              display: "inline-block",
              marginTop: 12,
              padding: "10px 22px",
              borderRadius: 10,
              background: "linear-gradient(135deg, #0ea5e9, #16a34a)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            Get started — free
          </Link>
        </article>
      </section>
    );
  }

  const userId = auth.userId;

  const [user, prefs, notifPrefs, sessions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        fullName: true,
        email: true,
        phone: true,
        emailVerifiedAt: true,
        avatarUrl: true,
      },
    }),
    prisma.userPreference.findUnique({ where: { userId } }),
    prisma.notificationPreference.findUnique({ where: { userId } }),
    prisma.userSession.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  if (!user) return null;

  return (
    <section>
      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 600,
            color: "var(--text)",
            letterSpacing: -0.5,
          }}
        >
          Settings
        </h1>
        <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 12 }}>
          Account preferences, notifications, and security
        </p>
      </div>

      <div className="user-split-2" style={{ gap: 14 }}>
        <article
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: 20,
          }}
        >
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
            <FiUser size={16} /> Account
          </h3>

          <AccountForm
            user={{
              fullName: user.fullName,
              email: user.email,
              phone: user.phone,
              avatarUrl: user.avatarUrl ?? null,
            }}
          />
        </article>

        <article
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: 20,
          }}
        >
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
            <FiBell size={16} /> Notifications
          </h3>

          <NotificationPreferences
            initial={{
              inAppEnabled: notifPrefs?.inAppEnabled ?? true,
              pushEnabled: notifPrefs?.pushEnabled ?? true,
              emailEnabled: notifPrefs?.emailEnabled ?? true,
              marketAlerts: notifPrefs?.marketAlerts ?? true,
              portfolioAlerts: notifPrefs?.portfolioAlerts ?? true,
              budgetAlerts: notifPrefs?.budgetAlerts ?? true,
              socialAlerts: notifPrefs?.socialAlerts ?? true,
              advisorAlerts: notifPrefs?.advisorAlerts ?? true,
            }}
          />
        </article>

        <article className="theme-panel-card">
          <h3 className="theme-panel-title">
            <FiSliders size={16} /> Preferences
          </h3>

          <ThemeSettingsField />

          <label
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-muted)",
              marginBottom: 4,
            }}
          >
            Currency
          </label>
          <select
            defaultValue="INR"
            style={{
              width: "100%",
              height: 38,
              padding: "0 12px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
            }}
          >
            <option value="INR">INR (₹)</option>
            <option value="USD">USD ($) (coming soon)</option>
          </select>
        </article>

        <article
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: 20,
          }}
        >
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
            <FiLock size={16} /> Active Sessions ({sessions.length})
          </h3>

          {sessions.length === 0 ? (
            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 12 }}>No active sessions.</p>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "var(--surface-2)",
                  marginBottom: 8,
                  fontSize: 12,
                }}
              >
                <p style={{ margin: 0, fontWeight: 600, fontSize: 12 }}>
                  {s.userAgent?.slice(0, 50) ?? "Unknown device"}
                </p>
                <p style={{ margin: "2px 0 0", color: "var(--text-muted)", fontSize: 11 }}>
                  {s.ipAddress ?? "—"} · Started {s.createdAt.toLocaleDateString()}
                </p>
              </div>
            ))
          )}

          <form action="/api/v1/auth/logout" method="POST" style={{ marginTop: 14 }}>
            <button
              type="submit"
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 10,
                background: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.30)",
                color: "#991b1b",
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Sign out everywhere
            </button>
          </form>
        </article>
      </div>
    </section>
  );
}
