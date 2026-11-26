/**
 * Equipe e parceiros: comissão, serviços por profissional, jornada,
 * folgas/bloqueios e desligamento com tratamento explícito das reservas.
 */
import { z } from "zod";
import { prisma } from "../db";
import { DomainError, forbidden, notFound } from "../errors";
import { assertAdmin, assertBarber, isAdmin, type Actor } from "../actor";
import { audit } from "../audit";
import { cancelAppointment, rescheduleAppointment } from "./appointments";
import { notify, notifyAdmins } from "./notifications";
import { toZoned, zonedToUtc, addDays, isValidDateStr, formatDateTime } from "@/lib/time";
import { specialtiesSchema } from "./accounts";

async function getBarberInShop(actor: Actor, barberProfileId: string) {
  const b = await prisma.barberProfile.findFirst({ where: { id: barberProfileId, shopId: actor.shopId } });
  if (!b) throw notFound("Profissional não encontrado.");
  return b;
}

/** Barbeiro só altera a própria agenda; proprietário altera qualquer uma */
function assertCanManageBarber(actor: Actor, barberProfileId: string) {
  if (isAdmin(actor)) return;
  if (actor.barberProfileId !== barberProfileId) throw forbidden();
}

// ─── Comissão ────────────────────────────────────────────────────────────────

export const commissionSchema = z.object({
  commissionModel: z.enum(["PERCENT", "PER_SERVICE", "FIXED"]),
  commissionPercent: z.coerce.number().int().min(0).max(100),
  fixedFeeCents: z.coerce.number().int().min(0),
  partnershipType: z.string().trim().max(40),
});

/** Alterar a regra NÃO recalcula comissões já registradas (snapshot imutável) */
export async function updateCommission(actor: Actor, barberProfileId: string, raw: unknown) {
  assertAdmin(actor);
  const input = commissionSchema.parse(raw);
  const before = await getBarberInShop(actor, barberProfileId);
  await prisma.barberProfile.update({ where: { id: barberProfileId }, data: input });
  await audit({ shopId: actor.shopId, actorUserId: actor.userId, action: "COMMISSION_RULE_CHANGED", entity: "BarberProfile", entityId: barberProfileId, data: { before: { model: before.commissionModel, percent: before.commissionPercent, fixed: before.fixedFeeCents }, after: input } });
}

// ─── Serviços por profissional ───────────────────────────────────────────────

export const barberServicesSchema = z.array(
  z.object({
    serviceId: z.string(),
    enabled: z.boolean(),
    priceCents: z.number().int().min(0).nullable(),
    durationMin: z.number().int().min(5).max(480).nullable(),
    commissionPercent: z.number().int().min(0).max(100).nullable(),
  }),
);

export async function updateBarberServices(actor: Actor, barberProfileId: string, raw: unknown) {
  const shop = await prisma.shop.findUniqueOrThrow({ where: { id: actor.shopId } });
  const admin = isAdmin(actor);
  if (!admin) {
    assertCanManageBarber(actor, barberProfileId);
    if (!shop.barberCanEditPrices) throw forbidden("O proprietário não liberou a edição de preços pelos profissionais.");
  }
  await getBarberInShop(actor, barberProfileId);
  const items = barberServicesSchema.parse(raw);
  await prisma.$transaction(async (tx) => {
    for (const it of items) {
      const svc = await tx.service.findFirst({ where: { id: it.serviceId, shopId: actor.shopId } });
      if (!svc) continue;
      if (it.durationMin && it.durationMin % 5 !== 0) throw new DomainError("Durações devem ser múltiplas de 5 minutos.");
      const existing = await tx.barberService.findUnique({ where: { barberProfileId_serviceId: { barberProfileId, serviceId: it.serviceId } } });
      // Barbeiro não altera percentuais de comissão
      const commissionPercent = admin ? it.commissionPercent : existing?.commissionPercent ?? null;
      await tx.barberService.upsert({
        where: { barberProfileId_serviceId: { barberProfileId, serviceId: it.serviceId } },
        create: { barberProfileId, serviceId: it.serviceId, active: it.enabled, priceCents: it.priceCents, durationMin: it.durationMin, commissionPercent },
        update: { active: it.enabled, priceCents: it.priceCents, durationMin: it.durationMin, commissionPercent },
      });
    }
    await audit({ shopId: actor.shopId, actorUserId: actor.userId, action: "BARBER_SERVICES_UPDATED", entity: "BarberProfile", entityId: barberProfileId }, tx);
  });
}

// ─── Jornada ─────────────────────────────────────────────────────────────────

export const workingHoursSchema = z.array(
  z
    .object({
      weekday: z.number().int().min(0).max(6),
      enabled: z.boolean(),
      startMin: z.number().int().min(0).max(1440),
      endMin: z.number().int().min(0).max(1440),
      breakStartMin: z.number().int().min(0).max(1440).nullable(),
      breakEndMin: z.number().int().min(0).max(1440).nullable(),
    })
    .refine((h) => !h.enabled || h.endMin > h.startMin, "O fim do expediente deve ser depois do início")
    .refine((h) => !h.enabled || h.breakStartMin == null || h.breakEndMin == null || (h.breakEndMin > h.breakStartMin && h.breakStartMin >= h.startMin && h.breakEndMin <= h.endMin), "Intervalo deve estar dentro do expediente"),
);

export async function updateWorkingHours(actor: Actor, barberProfileId: string, raw: unknown) {
  assertCanManageBarber(actor, barberProfileId);
  await getBarberInShop(actor, barberProfileId);
  const days = workingHoursSchema.parse(raw);
  await prisma.$transaction(async (tx) => {
    for (const d of days) {
      if (!d.enabled) {
        await tx.workingHours.deleteMany({ where: { barberProfileId, weekday: d.weekday } });
        continue;
      }
      const data = { startMin: d.startMin, endMin: d.endMin, breakStartMin: d.breakStartMin, breakEndMin: d.breakEndMin };
      await tx.workingHours.upsert({ where: { barberProfileId_weekday: { barberProfileId, weekday: d.weekday } }, create: { barberProfileId, weekday: d.weekday, ...data }, update: data });
    }
    await audit({ shopId: actor.shopId, actorUserId: actor.userId, action: "WORKING_HOURS_UPDATED", entity: "BarberProfile", entityId: barberProfileId }, tx);
  });
}

// ─── Folgas, férias e bloqueios ──────────────────────────────────────────────

export const timeOffSchema = z
  .object({
    barberProfileId: z.string(),
    kind: z.enum(["DAY_OFF", "VACATION", "BLOCK"]),
    startDate: z.string().refine(isValidDateStr, "Data inicial inválida"),
    endDate: z.string().refine(isValidDateStr, "Data final inválida"),
    startMin: z.number().int().min(0).max(1440).nullable().optional(),
    endMin: z.number().int().min(0).max(1440).nullable().optional(),
    reason: z.string().trim().max(200).default(""),
  })
  .refine((d) => d.endDate >= d.startDate, { message: "A data final deve ser igual ou posterior à inicial", path: ["endDate"] });

export async function createTimeOff(actor: Actor, raw: unknown) {
  const input = timeOffSchema.parse(raw);
  assertCanManageBarber(actor, input.barberProfileId);
  const barber = await getBarberInShop(actor, input.barberProfileId);
  const shop = await prisma.shop.findUniqueOrThrow({ where: { id: actor.shopId } });
  const admin = isAdmin(actor);
  const partial = input.kind === "BLOCK" && input.startMin != null && input.endMin != null;
  const startsAt = zonedToUtc(input.startDate, partial ? input.startMin! : 0, shop.timezone);
  const endsAt = partial ? zonedToUtc(input.endDate, input.endMin!, shop.timezone) : zonedToUtc(addDays(input.endDate, 1), 0, shop.timezone);
  if (endsAt <= startsAt) throw new DomainError("Período inválido.");
  // Barbeiro: bloqueios entram aprovados se o proprietário permitir; folgas e férias exigem aprovação
  const status = admin || (input.kind === "BLOCK" && shop.barberCanBlockAgenda) ? "APPROVED" : "PENDING";
  const conflicts = await prisma.appointment.findMany({
    where: { barberProfileId: input.barberProfileId, status: { in: ["PENDING", "CONFIRMED"] }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
    include: { client: { select: { name: true } } },
  });
  const timeOff = await prisma.timeOff.create({
    data: { barberProfileId: input.barberProfileId, kind: input.kind, startsAt, endsAt, reason: input.reason, status, createdById: actor.userId },
  });
  if (status === "PENDING") {
    await notifyAdmins(actor.shopId, { type: "TIME_OFF_REQUEST", title: "Pedido de folga", body: `${barber.displayName} solicitou ${input.kind === "VACATION" ? "férias" : "folga"} de ${input.startDate} a ${input.endDate}.`, link: "/admin/equipe" });
  }
  await audit({ shopId: actor.shopId, actorUserId: actor.userId, action: "TIME_OFF_CREATED", entity: "TimeOff", entityId: timeOff.id, data: { ...input, status } });
  return {
    timeOff,
    conflicts: conflicts.map((c) => ({ id: c.id, when: formatDateTime(c.startsAt, shop.timezone), client: c.client.name })),
  };
}

export async function reviewTimeOff(actor: Actor, timeOffId: string, approve: boolean) {
  assertAdmin(actor);
  const t = await prisma.timeOff.findFirst({ where: { id: timeOffId, barber: { shopId: actor.shopId } }, include: { barber: true } });
  if (!t) throw notFound();
  await prisma.timeOff.update({ where: { id: timeOffId }, data: { status: approve ? "APPROVED" : "REJECTED" } });
  if (t.barber.userId) {
    await notify({ userId: t.barber.userId, type: "TIME_OFF_REQUEST", title: approve ? "Folga aprovada" : "Folga recusada", body: `Seu pedido (${toZoned(t.startsAt).date}) foi ${approve ? "aprovado" : "recusado"}.`, link: "/barbeiro/disponibilidade" });
  }
}

export async function deleteTimeOff(actor: Actor, timeOffId: string) {
  const t = await prisma.timeOff.findFirst({ where: { id: timeOffId, barber: { shopId: actor.shopId } } });
  if (!t) throw notFound();
  assertCanManageBarber(actor, t.barberProfileId);
  if (!isAdmin(actor) && t.status === "APPROVED" && t.kind !== "BLOCK") throw forbidden("Folgas aprovadas só podem ser removidas pelo proprietário.");
  await prisma.timeOff.delete({ where: { id: timeOffId } });
}

// ─── Perfil profissional (campos autorizados) ────────────────────────────────

export const barberPublicProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(60),
  bio: z.string().trim().max(800),
  specialties: specialtiesSchema,
  experience: z.string().trim().max(800).optional().default(""),
  photoUrl: z.string().max(300).nullable().optional(),
});

export async function updateBarberPublicProfile(actor: Actor, barberProfileId: string, raw: unknown) {
  assertCanManageBarber(actor, barberProfileId);
  await getBarberInShop(actor, barberProfileId);
  const input = barberPublicProfileSchema.parse(raw);
  await prisma.barberProfile.update({
    where: { id: barberProfileId },
    data: { displayName: input.displayName, bio: input.bio, specialties: JSON.stringify(input.specialties), experience: input.experience, ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl } : {}) },
  });
}

// ─── Desligamento ────────────────────────────────────────────────────────────

export const offboardSchema = z.object({
  barberProfileId: z.string(),
  strategy: z.enum(["CANCEL", "REASSIGN"]),
  targetBarberProfileId: z.string().optional(),
  reason: z.string().trim().max(200).default(""),
});

/**
 * Desliga um profissional. Exige tratamento explícito dos atendimentos
 * futuros: cancelamento com notificação ou redistribuição para outro
 * profissional (cada reserva é revalidada na agenda do destino).
 * Históricos operacionais e financeiros são preservados.
 */
export async function offboardBarber(actor: Actor, raw: unknown) {
  assertAdmin(actor);
  const input = offboardSchema.parse(raw);
  const barber = await getBarberInShop(actor, input.barberProfileId);
  if (barber.userId === actor.userId) throw new DomainError("Você não pode desligar o próprio perfil do proprietário.");
  const future = await prisma.appointment.findMany({
    where: { barberProfileId: barber.id, status: { in: ["PENDING", "CONFIRMED"] }, startsAt: { gt: new Date() } },
    orderBy: { startsAt: "asc" },
  });
  const shop = await prisma.shop.findUniqueOrThrow({ where: { id: actor.shopId } });
  const failed: string[] = [];
  for (const a of future) {
    if (input.strategy === "REASSIGN") {
      if (!input.targetBarberProfileId) throw new DomainError("Escolha o profissional que receberá os atendimentos.");
      const z = toZoned(a.startsAt, shop.timezone);
      try {
        await rescheduleAppointment(actor, a.id, { date: z.date, startMin: z.minutes, barberProfileId: input.targetBarberProfileId });
      } catch {
        failed.push(formatDateTime(a.startsAt, shop.timezone));
      }
    } else {
      await cancelAppointment(actor, a.id, input.reason || "Profissional não faz mais parte da equipe. Pedimos desculpas — reagende com outro profissional.");
    }
  }
  if (failed.length) {
    throw new DomainError(`Não foi possível transferir ${failed.length} atendimento(s) (${failed.join(", ")}) por falta de horário no destino. Resolva-os individualmente e tente novamente.`);
  }
  await prisma.$transaction(async (tx) => {
    await tx.barberProfile.update({ where: { id: barber.id }, data: { status: "INACTIVE" } });
    if (barber.userId) await tx.roleAssignment.deleteMany({ where: { userId: barber.userId, shopId: actor.shopId, role: "BARBER" } });
    await tx.station.updateMany({ where: { barberProfileId: barber.id }, data: { barberProfileId: null } });
    await tx.invite.updateMany({ where: { barberProfileId: barber.id, acceptedAt: null }, data: { revokedAt: new Date() } });
    await audit({ shopId: actor.shopId, actorUserId: actor.userId, action: "BARBER_OFFBOARDED", entity: "BarberProfile", entityId: barber.id, data: { strategy: input.strategy, handled: future.length } }, tx);
  });
  return { handled: future.length };
}

/** Reativa um profissional desligado */
export async function reactivateBarber(actor: Actor, barberProfileId: string) {
  assertAdmin(actor);
  const barber = await getBarberInShop(actor, barberProfileId);
  if (barber.status !== "INACTIVE" || !barber.userId) throw new DomainError("Somente profissionais desligados com conta podem ser reativados.");
  await prisma.$transaction(async (tx) => {
    await tx.barberProfile.update({ where: { id: barberProfileId }, data: { status: "APPROVED" } });
    await tx.roleAssignment.upsert({
      where: { userId_shopId_role: { userId: barber.userId!, shopId: actor.shopId, role: "BARBER" } },
      create: { userId: barber.userId!, shopId: actor.shopId, role: "BARBER", grantedById: actor.userId },
      update: {},
    });
  });
}

/** Concede ou remove acesso administrativo (somente proprietário) */
export async function setAdminRole(actor: Actor, userId: string, grant: boolean) {
  assertAdmin(actor);
  if (!grant && userId === actor.userId) throw new DomainError("Você não pode remover seu próprio acesso de proprietário.");
  if (grant) {
    await prisma.roleAssignment.upsert({ where: { userId_shopId_role: { userId, shopId: actor.shopId, role: "ADMIN" } }, create: { userId, shopId: actor.shopId, role: "ADMIN", grantedById: actor.userId }, update: {} });
  } else {
    await prisma.roleAssignment.deleteMany({ where: { userId, shopId: actor.shopId, role: "ADMIN" } });
  }
  await audit({ shopId: actor.shopId, actorUserId: actor.userId, action: grant ? "ADMIN_GRANTED" : "ADMIN_REVOKED", entity: "User", entityId: userId });
}

export { assertBarber };
