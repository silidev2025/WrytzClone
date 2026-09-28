/*
 * Sending email is optional. With RESEND_API_KEY and MAIL_FROM set, messages go out through
 * Resend (https://resend.com); without them nothing is sent and the operator handles resets
 * from the Operator page instead.
 */

export function mailConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

export async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  if (!mailConfigured()) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, text }),
    });
    if (!res.ok) console.error("[mail] send failed", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (err) {
    console.error("[mail] send failed", err);
    return false;
  }
}
