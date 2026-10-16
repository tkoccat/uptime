import type { RenderedEmail } from "./render";

// Resend REST API'si (ek bağımlılık gerektirmez). RESEND_API_KEY yoksa e-posta konsola yazılır (geliştirme).
export async function sendEmail(to: string, email: RenderedEmail): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(`[email] RESEND_API_KEY yok, gönderilmedi: "${email.subject}" -> ${to}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "Uptime SaaS <noreply@example.com>",
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Resend hatası ${res.status}`);
}
