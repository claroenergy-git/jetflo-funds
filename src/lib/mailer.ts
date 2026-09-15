import nodemailer from "nodemailer";

let transport: ReturnType<typeof nodemailer.createTransport> | null | undefined;

function getTransport() {
  if (transport !== undefined) return transport;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    console.warn("Mailer: SMTP_HOST/SMTP_USER/SMTP_PASSWORD not set — notifications are disabled.");
    transport = null;
    return transport;
  }
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
  return transport;
}

export function siteUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderBrandedShell(subject: string, innerHtml: string): string {
  if (innerHtml.includes("<!DOCTYPE") || innerHtml.includes("<html")) {
    return innerHtml;
  }

  // Style plain links to look like clean indigo buttons/links
  const styledContent = innerHtml.replace(
    /<a\s+href="([^"]+)">([^<]+)<\/a>/gi,
    `<a href="$1" style="display:inline-block;margin-top:10px;background-color:#2563eb;color:#ffffff;font-weight:600;font-size:14px;padding:9px 18px;border-radius:6px;text-decoration:none;box-shadow:0 1px 2px rgba(0,0,0,0.05);">$2 &rarr;</a>`
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:580px;background-color:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05),0 2px 4px -2px rgba(0,0,0,0.05);border:1px solid #e2e8f0;">
          <!-- Header -->
          <tr>
            <td style="background-color:#0f172a;padding:20px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <div style="font-size:18px;font-weight:700;letter-spacing:-0.02em;color:#ffffff;">
                      JetFlo <span style="color:#60a5fa;font-weight:400;">Funds Portal</span>
                    </div>
                    <div style="font-size:11px;color:#94a3b8;margin-top:2px;letter-spacing:0.04em;text-transform:uppercase;">
                      Claro Energy
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Subject Banner -->
          <tr>
            <td style="background-color:#f1f5f9;padding:12px 28px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:600;color:#475569;">
              ${escapeHtml(subject)}
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding:28px;font-size:15px;line-height:1.6;color:#334155;">
              ${styledContent}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:16px 28px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;line-height:1.5;">
              <p style="margin:0;">Automated notification from the <strong>JetFlo Funds Portal</strong>.</p>
              <p style="margin:4px 0 0 0;color:#94a3b8;">Claro Energy Private Limited · Internal Use Only</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content?: string | Buffer;
    path?: string;
    contentType?: string;
  }>;
}

export async function sendMail(opts: SendMailOptions): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const t = getTransport();
  if (!t) {
    return { ok: false, error: "SMTP not configured" };
  }
  const to = Array.isArray(opts.to) ? opts.to.filter(Boolean) : opts.to;
  if (!to || (Array.isArray(to) && to.length === 0)) {
    return { ok: false, error: "No recipient specified" };
  }

  const renderedHtml = renderBrandedShell(opts.subject, opts.html);
  const plainText =
    opts.text ||
    opts.html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .trim();

  try {
    const info = await t.sendMail({
      from: process.env.SMTP_FROM || "JetFlo Funds Portal <noreply@claroenergy.in>",
      to,
      subject: opts.subject,
      html: renderedHtml,
      text: plainText,
      attachments: opts.attachments,
    });
    return { ok: true, messageId: info.messageId };
  } catch (err: any) {
    console.error("Mailer: sendMail error:", opts.subject, err);
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Fire-and-forget notification. A notification failure must never fail the
 * workflow action that triggered it — errors are logged, never thrown.
 */
export function notify(opts: SendMailOptions): void {
  sendMail(opts).catch((err) => {
    console.error("Mailer: failed to send notification:", opts.subject, err);
  });
}
