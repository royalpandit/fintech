/**
 * Outbound email.
 *
 * Provider-agnostic on purpose: Resend is the default because it needs only an
 * API key, but the transport is swappable without touching callers. With no key
 * configured, sends are skipped and logged rather than throwing — so the rest of
 * the notification pipeline behaves identically whether or not email is set up.
 */

export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export function isMailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.MAIL_FROM?.trim());
}

/** Strip tags for the plain-text alternative when a caller doesn't supply one. */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function sendMail(msg: MailMessage): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.MAIL_FROM?.trim();

  if (!apiKey || !from) {
    console.warn("[mail] skipped (RESEND_API_KEY / MAIL_FROM not set): %s", msg.subject);
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text ?? htmlToText(msg.html),
      }),
    });
    if (!res.ok) {
      console.warn("[mail] provider rejected (%s): %s", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[mail] send failed: %s", (e as Error).message);
    return false;
  }
}

// ── Templates ───────────────────────────────────────────────────────────────

const BRAND = "#0ea5e9";

function shell(bodyHtml: string, footerNote?: string): string {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f1f5f9;font-family:system-ui,-apple-system,Segoe UI,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;">
    <tr><td style="padding:20px 24px;border-bottom:1px solid #e2e8f0;">
      <span style="font-size:18px;font-weight:700;color:${BRAND};">Finuer</span>
    </td></tr>
    <tr><td style="padding:24px;color:#0f172a;font-size:14px;line-height:1.55;">${bodyHtml}</td></tr>
    <tr><td style="padding:16px 24px;border-top:1px solid #e2e8f0;color:#64748b;font-size:11px;">
      ${footerNote ?? "You're receiving this because email notifications are on."}
      <br/>Manage them in Settings → Notifications.
    </td></tr>
  </table></body></html>`;
}

export type DigestItem = { title: string; message: string; href?: string | null };

/** One email summarising several notifications, rather than one email each. */
export function renderDigest(params: {
  name: string;
  items: DigestItem[];
  baseUrl: string;
}): { subject: string; html: string } {
  const { name, items, baseUrl } = params;
  const count = items.length;

  const rows = items
    .map((n) => {
      const href = n.href ? `${baseUrl}${n.href}` : `${baseUrl}/user/notifications`;
      return `<tr><td style="padding:10px 0;border-bottom:1px solid #eef2f7;">
        <a href="${href}" style="color:#0f172a;text-decoration:none;font-weight:600;">${escapeHtml(n.title)}</a>
        <div style="color:#64748b;font-size:13px;margin-top:2px;">${escapeHtml(n.message)}</div>
      </td></tr>`;
    })
    .join("");

  return {
    subject: count === 1 ? items[0].title : `${count} updates on Finuer`,
    html: shell(
      `<p style="margin:0 0 14px;">Hi ${escapeHtml(name.split(" ")[0] || "there")}, here's what you missed:</p>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
       <p style="margin:20px 0 0;">
         <a href="${baseUrl}/user/notifications" style="display:inline-block;padding:10px 18px;border-radius:9px;background:${BRAND};color:#fff;text-decoration:none;font-weight:600;font-size:13px;">Open Finuer</a>
       </p>`,
    ),
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
