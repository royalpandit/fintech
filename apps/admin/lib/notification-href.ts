/**
 * Where a notification should take you when clicked.
 *
 * `lib/notify.ts` stamps `data.href` on everything it writes. This is the one
 * place that reads it back, so the user, advisor and super-admin lists all
 * resolve destinations identically.
 */

export type NotificationData = { href?: unknown; kind?: unknown } | null | undefined;

/**
 * Advisors live under /advisor/*, so a few destinations need remapping from the
 * user-facing path stored on the notification.
 */
const ADVISOR_REWRITES: { match: RegExp; to: (m: RegExpMatchArray) => string }[] = [
  { match: /^\/user\/messages\/(\d+)$/, to: (m) => `/advisor/messages/${m[1]}` },
  { match: /^\/user\/markets\/(\d+)(#.*)?$/, to: (m) => `/advisor/posts/${m[1]}` },
];

export function notificationHref(
  data: NotificationData,
  audience: "user" | "advisor" = "user",
): string | null {
  const raw = data?.href;
  // Only ever follow same-origin paths — never a value that could redirect off-site.
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) return null;

  if (audience === "advisor") {
    for (const rule of ADVISOR_REWRITES) {
      const m = raw.match(rule.match);
      if (m) return rule.to(m);
    }
  }
  return raw;
}
