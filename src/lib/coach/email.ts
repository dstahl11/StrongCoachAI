import "server-only";
import { Resend } from "resend";

/** Resend email client. Reminders/digests go out from here. */
let _resend: Resend | null = null;

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && fromAddress());
}

export function fromAddress(): string {
  // Resend's onboarding sender works without a verified domain for testing.
  return process.env.COACH_FROM_EMAIL || "Coach <onboarding@resend.dev>";
}

function client(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

export type SendResult = { ok: boolean; id?: string; error?: string };

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendResult> {
  if (!emailConfigured()) {
    return { ok: false, error: "Email not configured (set RESEND_API_KEY)." };
  }
  if (!opts.to) return { ok: false, error: "No recipient email set." };
  try {
    const res = await client().emails.send({
      from: fromAddress(),
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    if (res.error) return { ok: false, error: res.error.message };
    return { ok: true, id: res.data?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

/** Minimal, email-client-safe HTML wrapper. */
export function emailShell(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f3f4f6;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">
    <div style="background:#1d54d6;padding:16px 20px;color:#fff;font-weight:700;font-size:16px">${title}</div>
    <div style="padding:20px;font-size:15px;line-height:1.55">${bodyHtml}</div>
    <div style="padding:12px 20px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px">StrongCoach · your AI strength coach</div>
  </div>
</body></html>`;
}
