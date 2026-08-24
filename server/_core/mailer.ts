import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;

type MailCredentials = { user: string; pass: string; from: string };

function smtpCredentials(): MailCredentials {
  // Generic SMTP first (SMTP_USER/SMTP_PASS/SMTP_FROM), then legacy Gmail
  // app-password variables.
  const user =
    process.env.SMTP_USER ||
    process.env.GMAIL_USER ||
    process.env.VITE_GMAIL_USER ||
    "";
  const rawPass =
    process.env.SMTP_PASS ||
    process.env.GMAIL_APP_PASSWORD ||
    process.env.VITE_GMAIL_APP_PASSWORD ||
    "";
  const from = process.env.SMTP_FROM || process.env.MAIL_FROM || user;
  return { user, pass: rawPass.replace(/\s+/g, ""), from };
}

export function isMailerConfigured(): boolean {
  const { user, pass } = smtpCredentials();
  return user.length > 0 && pass.length > 0;
}

function getTransporter(): Transporter | null {
  if (!isMailerConfigured()) return null;
  if (!transporter) {
    const { user, pass } = smtpCredentials();
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465;
    transporter = nodemailer.createTransport(
      host
        ? { host, port, secure: port === 465, auth: { user, pass } }
        : { service: "gmail", auth: { user, pass } }
    );
  }
  return transporter;
}

export async function verifyMailer(): Promise<boolean> {
  const mailer = getTransporter();
  if (!mailer) return false;
  try {
    await mailer.verify();
    return true;
  } catch (error) {
    console.warn("[Mailer] SMTP verification failed:", error);
    return false;
  }
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export type PasswordResetEmailInput = {
  to: string;
  name?: string | null;
  resetUrl: string;
};

// Branded transactional email for the forgot-password flow. Inline styles only,
// since Gmail strips <style> blocks.
export async function sendPasswordResetEmail({ to, name, resetUrl }: PasswordResetEmailInput): Promise<void> {
  const mailer = getTransporter();
  if (!mailer) throw new Error("Mailer is not configured");

  const { from } = smtpCredentials();
  const firstName = (name ?? "").trim().split(/\s+/)[0] || "there";

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f4f3f1;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f3f1;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border-radius:20px;border:1px solid #e6e4e0;overflow:hidden;">
            <tr>
              <td style="padding:36px 36px 8px;text-align:center;">
                <div style="width:48px;height:48px;margin:0 auto;border-radius:12px;border:1px solid #e6e4e0;background:#111110;line-height:48px;color:#faf9f7;font-size:18px;font-weight:700;">K</div>
                <p style="margin:14px 0 0;font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#8a877f;">KSEMO</p>
                <h1 style="margin:12px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:500;letter-spacing:-0.03em;color:#191817;">Reset your password</h1>
                <p style="margin:10px 0 0;font-size:14px;line-height:22px;color:#6d6a62;">Hi ${escapeHtml(firstName)}, we received a request to reset the password for your KSEMO account.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 36px 8px;">
                <a href="${resetUrl}" style="display:block;width:100%;box-sizing:border-box;background-color:#191817;color:#ffffff;text-align:center;text-decoration:none;font-size:15px;font-weight:500;padding:13px 0;border-radius:12px;">Choose a new password</a>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 36px 0;">
                <p style="margin:0;font-size:12px;line-height:19px;color:#8a877f;">This link works once and expires in one hour. If you didn't request a reset, you can safely ignore this email — your password stays unchanged.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 36px 30px;">
                <p style="margin:0;font-size:11px;line-height:17px;color:#b3b0a8;">Button not working? Paste this link into your browser:<br /><span style="color:#6d6a62;word-break:break-all;">${resetUrl}</span></p>
              </td>
            </tr>
          </table>
          <p style="margin:18px 0 0;font-size:11px;line-height:17px;color:#8a877f;">Your private space to think, talk, and remember.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  await mailer.sendMail({
    from: `"KSEMO" <${from}>`,
    to,
    subject: "Reset your KSEMO password",
    text: [
      `Hi ${firstName},`,
      "",
      "We received a request to reset your KSEMO password.",
      "Open this one-time link within the next hour to choose a new password:",
      resetUrl,
      "",
      "If you didn't request this, you can ignore this email.",
      "",
      "— KSEMO",
    ].join("\n"),
    html,
  });
}

export type FeedbackEmailInput = {
  fromName: string;
  fromEmail: string;
  category: string;
  message: string;
};

// Delivers in-app user feedback to the team inbox, reply-addressed to the
// sender so the conversation can continue over email.
export async function sendFeedbackEmail({
  fromName,
  fromEmail,
  category,
  message,
}: FeedbackEmailInput): Promise<void> {
  const mailer = getTransporter();
  if (!mailer) throw new Error("Mailer is not configured");

  const { from } = smtpCredentials();
  const safeCategory = escapeHtml(category);
  const safeName = escapeHtml(fromName);
  const safeEmail = escapeHtml(fromEmail || "(no email on account)");
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br />");
  const plainReplyTo =
    fromEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)
      ? fromEmail
      : undefined;

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f4f3f1;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f3f1;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;border:1px solid #e6e4e0;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 0;">
                <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#8a877f;">KSEMO Feedback</p>
                <h1 style="margin:8px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:500;letter-spacing:-0.02em;color:#191817;">${safeCategory}</h1>
                <p style="margin:10px 0 0;font-size:13px;line-height:20px;color:#6d6a62;">From <strong>${safeName}</strong> &lt;${safeEmail}&gt;</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px 28px;">
                <div style="border:1px solid #e6e4e0;border-radius:14px;padding:18px 20px;background:#faf9f7;">
                  <p style="margin:0;font-size:14px;line-height:23px;color:#191817;white-space:pre-wrap;">${safeMessage}</p>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  await mailer.sendMail({
    from: `"KSEMO" <${from}>`,
    to: from,
    ...(plainReplyTo ? { replyTo: plainReplyTo } : {}),
    subject: `[KSEMO feedback] ${category} — ${fromName}`,
    text: [
      `Category: ${category}`,
      `From: ${fromName} <${fromEmail || "no email on account"}>`,
      "",
      message,
    ].join("\n"),
    html,
  });
}
