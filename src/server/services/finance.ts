/**
 * Financeiro: pagamentos manuais/presenciais, comissões e repasses.
 *
 * Regras:
 * - Nenhum pagamento online está integrado. Todo pagamento é registrado
 *   manualmente e identificado como provider "MANUAL".
 * - Pagamento só fica CONFIRMED quando registrado/confirmado pelo
 *   proprietário. Barbeiros registram recebimentos como PENDING.
 * - Comissões são snapshots criados na conclusão do atendimento.
 */
import { z } from "zod";
import { prisma } from "../db";
import { DomainError, forbidden, notFound } from "../errors";
import { assertAdmin, isAdmin, type Actor } from "../actor";
import { audit } from "../audit";
import { PAYMENT_METHODS } from "@/types/domain";

export const paymentSchema = z.object({
  appointmentId: z.string(),
  amountCents: z.coerce.number().int().min(1, "Informe o valor recebido"),
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().trim().max(120).default(""),
});

export async function recordPayment(actor: Actor, raw: unknown) {
  const input = paymentSchema.parse(raw);
  const appt = await prisma.appointment.findFirst({ where: { id: input.appointmentId, shopId: actor.shopId }, include: { payments: true } });
  if (!appt) throw notFound("Atendimento não encontrado.");
  const admin = isAdmin(actor);
  if (!admin && appt.barberProfileId !== actor.barberProfileId) throw forbidden();
  if (["CANCELLED", "NO_SHOW"].includes(appt.status)) throw new DomainError("Não é possível registrar pagamento para atendimento cancelado ou ausente.");
  const paid = appt.payments.filter((p) => p.status !== "VOIDED").reduce((s, p) => s + p.amountCents, 0);
  if (paid + input.amountCents > appt.priceCents * 2) throw new DomainError("Valor muito acima do preço do atendimento. Verifique.");
  const payment = await prisma.payment.create({
    data: {
      appointmentId: appt.id,
      amountCents: input.amountCents,
      method: input.method,
      reference: input.reference,
      provider: "MANUAL",
      status: admin ? "CONFIRMED" : "PENDING",
      recordedById: actor.userId,
      confirmedById: admin ? actor.userId : null,
      confirmedAt: admin ? new Date() : null,
    },
  });
  await audit({ shopId: actor.shopId, actorUserId: actor.userId, action: "PAYMENT_RECORDED", entity: "Payment", entityId: payment.id, data: input });
  return payment;
}

export async function confirmPayment(actor: Actor, paymentId: string) {
  assertAdmin(actor);
  const p = await prisma.payment.findFirst({ where: { id: paymentId, appointment: { shopId: actor.shopId } } });
  if (!p) throw notFound();
  if (p.status !== "PENDING") throw new DomainError("Pagamento não está pendente.");
  await prisma.payment.update({ where: { id: paymentId }, data: { status: "CONFIRMED", confirmedById: actor.userId, confirmedAt: new Date() } });
  await audit({ shopId: actor.shopId, actorUserId: actor.userId, action: "PAYMENT_CONFIRMED", entity: "Payment", entityId: paymentId });
}

export async function voidPayment(actor: Actor, paymentId: string) {
  assertAdmin(actor);
  const p = await prisma.payment.findFirst({ where: { id: paymentId, appointment: { shopId: actor.shopId } } });
  if (!p) throw notFound();
  await prisma.payment.update({ where: { id: paymentId }, data: { status: "VOIDED" } });
  await audit({ shopId: actor.shopId, actorUserId: actor.userId, action: "PAYMENT_VOIDED", entity: "Payment", entityId: paymentId });
}

/** Registra repasse quitando as comissões em aberto selecionadas */
export async function recordPayout(actor: Actor, barberProfileId: string, commissionIds: string[], note = "") {
  assertAdmin(actor);
  if (commissionIds.length === 0) throw new DomainError("Selecione ao menos uma comissão.");
  return prisma.$transaction(async (tx) => {
    const commissions = await tx.commission.findMany({ where: { id: { in: commissionIds }, barberProfileId, status: "OPEN", barber: { shopId: actor.shopId } } });
    if (commissions.length !== commissionIds.length) throw new DomainError("Algumas comissões já foram pagas ou não pertencem a este profissional.");
    const total = commissions.reduce((s, c) => s + c.amountCents, 0);
    const payout = await tx.payout.create({ data: { shopId: actor.shopId, barberProfileId, amountCents: total, note: note.slice(0, 200), recordedById: actor.userId } });
    const updated = await tx.commission.updateMany({ where: { id: { in: commissionIds }, status: "OPEN" }, data: { status: "PAID", payoutId: payout.id } });
    if (updated.count !== commissionIds.length) throw new DomainError("Conflito ao registrar repasse. Tente novamente.");
    await audit({ shopId: actor.shopId, actorUserId: actor.userId, action: "PAYOUT_RECORDED", entity: "Payout", entityId: payout.id, data: { total, commissionIds } }, tx);
    return payout;
  });
}

export interface FinanceFilter {
  from: Date;
  to: Date;
  barberProfileId?: string;
}

/** Resumo financeiro (dados reais do período) */
export async function financeSummary(shopId: string, f: FinanceFilter) {
  const apptWhere = { shopId, startsAt: { gte: f.from, lt: f.to }, ...(f.barberProfileId ? { barberProfileId: f.barberProfileId } : {}) };
  const [completed, payments, commissions, openCommissions, payouts] = await Promise.all([
    prisma.appointment.findMany({ where: { ...apptWhere, status: "COMPLETED" }, include: { service: true, barber: true, payments: true } }),
    prisma.payment.findMany({ where: { appointment: apptWhere }, include: { appointment: { include: { service: true, barber: true, client: { select: { name: true } } } } }, orderBy: { createdAt: "desc" } }),
    prisma.commission.findMany({ where: { appointment: apptWhere }, include: { appointment: { include: { service: true, client: { select: { name: true } } } }, barber: true }, orderBy: { createdAt: "desc" } }),
    prisma.commission.aggregate({ where: { status: "OPEN", barber: { shopId }, ...(f.barberProfileId ? { barberProfileId: f.barberProfileId } : {}) }, _sum: { amountCents: true } }),
    prisma.payout.findMany({ where: { shopId, createdAt: { gte: f.from, lt: f.to }, ...(f.barberProfileId ? { barberProfileId: f.barberProfileId } : {}) }, include: { barber: true }, orderBy: { createdAt: "desc" } }),
  ]);
  const servicesValue = completed.reduce((s, a) => s + a.priceCents, 0);
  const confirmed = payments.filter((p) => p.status === "CONFIRMED").reduce((s, p) => s + p.amountCents, 0);
  const pendingConfirmation = payments.filter((p) => p.status === "PENDING").reduce((s, p) => s + p.amountCents, 0);
  const unpaid = completed.reduce((s, a) => {
    const paid = a.payments.filter((p) => p.status === "CONFIRMED").reduce((x, p) => x + p.amountCents, 0);
    return s + Math.max(0, a.priceCents - paid);
  }, 0);
  const commissionTotal = commissions.reduce((s, c) => s + c.amountCents, 0);
  const byBarber = new Map<string, { name: string; value: number; commission: number; count: number }>();
  for (const a of completed) {
    const row = byBarber.get(a.barberProfileId) ?? { name: a.barber.displayName, value: 0, commission: 0, count: 0 };
    row.value += a.priceCents;
    row.count++;
    byBarber.set(a.barberProfileId, row);
  }
  for (const c of commissions) {
    const row = byBarber.get(c.barberProfileId);
    if (row) row.commission += c.amountCents;
  }
  const byService = new Map<string, { name: string; value: number; count: number }>();
  for (const a of completed) {
    const row = byService.get(a.serviceId) ?? { name: a.service.name, value: 0, count: 0 };
    row.value += a.priceCents;
    row.count++;
    byService.set(a.serviceId, row);
  }
  return {
    servicesValue,
    confirmed,
    pendingConfirmation,
    unpaid,
    commissionTotal,
    openCommissionsAll: openCommissions._sum.amountCents ?? 0,
    payouts,
    payoutsTotal: payouts.reduce((s, p) => s + p.amountCents, 0),
    payments,
    commissions,
    completed,
    byBarber: [...byBarber.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.value - a.value),
    byService: [...byService.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.value - a.value),
  };
}
