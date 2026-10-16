import { enqueue } from "../queue";
import type { EmailTemplate } from "../email/render";

// Kullanıcıya şablonlu e-posta gönderimini kuyruğa ekler (tercih kontrolü iş içinde yapılır)
export async function queueUserEmail(
  userId: string,
  template: EmailTemplate,
  vars: Record<string, string | number> = {},
  ctaPath?: string
) {
  await enqueue("email", { userId, template, vars, ctaPath });
}
