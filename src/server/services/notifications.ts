/**
 * Notificações: registro in-app + fila de entrega (outbox) por canal.
 *
 * - Toda notificação aparece na central do usuário (in-app).
 * - Entregas externas (e-mail / WhatsApp) entram na fila apenas se o usuário
 *   consentiu com o canal. A chave única dedupeKey impede envios duplicados
 *   mesmo se o mesmo evento for disparado mais de uma vez.
 * - processOutbox() envia o que estiver na fila usando provedores reais
 *   quando há credenciais; sem credenciais, a entrega fica SKIPPED com o
 *   motivo registrado (nada é marcado como enviado sem ter sido).
 */
import { prisma, isUniqueViolation, type Tx } from "../db";

export type NotificationType =
  | "ACCOUNT_CREATED"
  | "PARTNER_REQUEST_SENT"
  | "PARTNER_REQUEST_RECEIVED"
  | "PARTNER_APPROVED"
  | "PARTNER_REJECTED"
  | "PARTNER_NEEDS_INFO"
  | "INVITE_RECEIVED"
  | "APPOINTMENT_CREATED"
  | "APPOINTMENT_CONFIRMED"
  | "APPOINTMENT_CANCELLED"
  | "APPOINTMENT_RESCHEDULED"
  | "APPOINTMENT_REMINDER"
  | "PASSWORD_RESET"
  | "TIME_OFF_REQUEST";

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  /** Identificador idempotente do evento (ex.: "reminder:<id>") */
  dedupeKey?: string;
  /** Envia por e-mail mesmo sem consentimento de marketing (transacional essencial, ex.: senha) */
  essentialEmail?: boolean;
  /** Não cria registro in-app (ex.: e-mail de recuperação de senha) */
  skipInApp?: boolean;
}

export async function notify(input: NotifyInput, tx: Tx = prisma) {
  const user = await tx.user.findUnique({ where: { id: input.userId }, select: { notifyEmail: true, notifyWhatsapp: true, phone: true, anonymizedAt: true } });
  if (!user || user.anonymizedAt) return null;
  const baseKey = input.dedupeKey ?? `${input.type}:${input.userId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;

  if (input.dedupeKey) {
    const existing = await tx.notificationDelivery.findUnique({ where: { dedupeKey: `${baseKey}:INAPP` } });
    if (existing) return null;
  }

  const notification = await tx.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
      readAt: input.skipInApp ? new Date() : null,
    },
  });

  const channels: string[] = ["INAPP"];
  if (user.notifyEmail || input.essentialEmail) channels.push("EMAIL");
  if (user.notifyWhatsapp && user.phone && !input.essentialEmail) channels.push("WHATSAPP");

  for (const channel of channels) {
    try {
      await tx.notificationDelivery.create({
        data: {
          notificationId: notification.id,
          channel,
          dedupeKey: `${baseKey}:${channel}`,
          status: channel === "INAPP" ? "SENT" : "QUEUED",
          sentAt: channel === "INAPP" ? new Date() : null,
        },
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  return notification;
}

export async function notifyAdmins(shopId: string, input: Omit<NotifyInput, "userId">, tx: Tx = prisma) {
  const admins = await tx.roleAssignment.findMany({ where: { shopId, role: "ADMIN" }, select: { userId: true } });
  for (const a of admins) {
    await notify({ ...input, userId: a.userId, dedupeKey: input.dedupeKey ? `${input.dedupeKey}:${a.userId}` : undefined }, tx);
  }
}

// ─── Provedores ──────────────────────────────────────────────────────────────

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}
export function whatsappConfigured() {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

async function sendEmail(to: string, subject: string, text: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text }),
  });
  if (!res.ok) throw new Error(`Resend HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

async function sendWhatsapp(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "");
  const to = digits.startsWith("55") ? digits : `55${digits}`;
  const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
  });
  if (!res.ok) throw new Error(`WhatsApp HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

/** Processa a fila. Idempotente: cada entrega é reivindicada antes do envio. */
export async function processOutbox(limit = 50) {
  const queued = await prisma.notificationDelivery.findMany({
    where: { status: "QUEUED", attempts: { lt: 5 } },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: { notification: { include: { user: { select: { email: true, phone: true, name: true } } } } },
  });
  const summary = { sent: 0, skipped: 0, failed: 0 };
  for (const d of queued) {
    // Reivindica a entrega (evita envio duplo por processadores concorrentes)
    const claimed = await prisma.notificationDelivery.updateMany({
      where: { id: d.id, status: "QUEUED", attempts: d.attempts },
      data: { attempts: { increment: 1 } },
    });
    if (claimed.count === 0) continue;
    const n = d.notification;
    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    const text = `${n.body}${n.link ? `\n\n${n.link.startsWith("http") ? n.link : appUrl + n.link}` : ""}`;
    try {
      if (d.channel === "EMAIL") {
        if (!emailConfigured()) {
          if (process.env.NODE_ENV !== "production") console.info(`[email:dev] para ${n.user.email} — ${n.title}\n${text}`);
          await prisma.notificationDelivery.update({ where: { id: d.id }, data: { status: "SKIPPED", lastError: "Provedor de e-mail não configurado (RESEND_API_KEY)" } });
          summary.skipped++;
          continue;
        }
        await sendEmail(n.user.email, n.title, text);
      } else if (d.channel === "WHATSAPP") {
        if (!whatsappConfigured()) {
          await prisma.notificationDelivery.update({ where: { id: d.id }, data: { status: "SKIPPED", lastError: "WhatsApp Business não configurado" } });
          summary.skipped++;
          continue;
        }
        await sendWhatsapp(n.user.phone, `${n.title}\n${text}`);
      }
      await prisma.notificationDelivery.update({ where: { id: d.id }, data: { status: "SENT", sentAt: new Date(), lastError: "" } });
      summary.sent++;
    } catch (err) {
      const failedForGood = d.attempts + 1 >= 5;
      await prisma.notificationDelivery.update({
        where: { id: d.id },
        data: { status: failedForGood ? "FAILED" : "QUEUED", lastError: String(err).slice(0, 500) },
      });
      summary.failed++;
    }
  }
  return summary;
}
