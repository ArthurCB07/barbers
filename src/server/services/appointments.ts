/**
 * Serviço de agendamentos.
 *
 * Garantias:
 * 1. Disponibilidade sempre recalculada no servidor (horário de funcionamento,
 *    jornada, intervalo, folgas, férias, feriados, bloqueios, antecedência,
 *    limite futuro, pausa entre atendimentos e reservas existentes).
 * 2. Condição de corrida: cada atendimento grava suas unidades de 5 minutos em
 *    AppointmentSlot, que tem restrição UNIQUE (barbeiro, unidade). Se duas
 *    reservas concorrentes disputarem o mesmo horário, o banco rejeita a
 *    segunda e a transação inteira é desfeita.
 * 3. Permissões verificadas para cada operação (cliente só mexe no que é seu,
 *    barbeiro só na própria agenda, proprietário em tudo).
 */
import { z } from "zod";
import { prisma, isUniqueViolation, type Tx } from "../db";
import { DomainError, forbidden, notFound } from "../errors";
import { isAdmin, type Actor } from "../actor";
import { generateSlots, dayUnavailableReason, slotUnits, type Interval, type Slot } from "@/features/appointments/availability";
import { computeCommission } from "@/features/finance/commission";
import { formatDateTime, isValidDateStr, weekdayOf, zonedToUtc, addDays } from "@/lib/time";
import { ACTIVE_STATUSES, APPOINTMENT_STATUS_LABEL, BLOCKING_STATUSES, STATUS_TRANSITIONS, type AppointmentStatus, type CommissionModel } from "@/types/domain";
import { notify } from "./notifications";
import { audit } from "../audit";

const dateSchema = z.string().refine(isValidDateStr, "Data inválida");

// ─── Consulta de barbeiro / serviço ──────────────────────────────────────────

export async function getBookableBarber(shopId: string, barberProfileId: string, tx: Tx = prisma) {
  const barber = await tx.barberProfile.findFirst({
    where: { id: barberProfileId, shopId, status: "APPROVED", userId: { not: null } },
  });
  if (!barber) throw new DomainError("Profissional indisponível para agendamento.");
  return barber;
}

export async function resolveBarberService(barberProfileId: string, serviceId: string, tx: Tx = prisma) {
  const bs = await tx.barberService.findUnique({
    where: { barberProfileId_serviceId: { barberProfileId, serviceId } },
    include: { service: true },
  });
  if (!bs || !bs.active || !bs.service.active) throw new DomainError("Este profissional não oferece o serviço selecionado.");
  return {
    serviceId,
    name: bs.service.name,
    priceCents: bs.priceCents ?? bs.service.priceCents,
    durationMin: bs.durationMin ?? bs.service.durationMin,
    commissionPercent: bs.commissionPercent,
  };
}

/** Serviços ofertados por um profissional, com preço e duração efetivos */
export async function listBarberServices(barberProfileId: string) {
  const rows = await prisma.barberService.findMany({
    where: { barberProfileId, active: true, service: { active: true } },
    include: { service: { include: { category: true } } },
    orderBy: { service: { sortOrder: "asc" } },
  });
  return rows.map((r) => ({
    id: r.serviceId,
    name: r.service.name,
    description: r.service.description,
    category: r.service.category?.name ?? "Serviços",
    priceCents: r.priceCents ?? r.service.priceCents,
    durationMin: r.durationMin ?? r.service.durationMin,
    imageUrl: r.service.imageUrl,
  }));
}

// ─── Disponibilidade ─────────────────────────────────────────────────────────

export interface AvailabilityQuery {
  shopId: string;
  barberProfileId: string;
  serviceId?: string;
  durationMin?: number;
  date: string;
  excludeAppointmentId?: string;
  now?: Date;
  /** Administrador pode ignorar a antecedência mínima ao lançar manualmente */
  ignoreMinAdvance?: boolean;
}

export async function getAvailability(q: AvailabilityQuery, tx: Tx = prisma): Promise<{ slots: Slot[]; reason: string | null; durationMin: number }> {
  dateSchema.parse(q.date);
  const shop = await tx.shop.findUniqueOrThrow({ where: { id: q.shopId } });
  const tz = shop.timezone;
  const now = q.now ?? new Date();
  let durationMin = q.durationMin ?? 0;
  if (q.serviceId) durationMin = (await resolveBarberService(q.barberProfileId, q.serviceId, tx)).durationMin;
  if (!durationMin) throw new DomainError("Duração do serviço não informada.");

  const weekday = weekdayOf(q.date);
  const dayStart = zonedToUtc(q.date, 0, tz);
  const dayEnd = zonedToUtc(addDays(q.date, 1), 0, tz);

  const [shopHours, holiday, working, timeOff, appts] = await Promise.all([
    tx.shopHours.findUnique({ where: { shopId_weekday: { shopId: shop.id, weekday } } }),
    tx.holiday.findUnique({ where: { shopId_date: { shopId: shop.id, date: q.date } } }),
    tx.workingHours.findUnique({ where: { barberProfileId_weekday: { barberProfileId: q.barberProfileId, weekday } } }),
    tx.timeOff.findMany({
      where: { barberProfileId: q.barberProfileId, status: "APPROVED", startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } },
    }),
    tx.appointment.findMany({
      where: {
        barberProfileId: q.barberProfileId,
        status: { in: BLOCKING_STATUSES },
        startsAt: { lt: dayEnd },
        endsAt: { gt: new Date(dayStart.getTime() - 4 * 3600000) },
        ...(q.excludeAppointmentId ? { id: { not: q.excludeAppointmentId } } : {}),
      },
      select: { startsAt: true, endsAt: true },
    }),
  ]);

  const rules = {
    date: q.date,
    tz,
    now,
    shopHours: shopHours && !shopHours.closed ? { openMin: shopHours.openMin, closeMin: shopHours.closeMin } : null,
    isHoliday: Boolean(holiday),
    working: working ? { startMin: working.startMin, endMin: working.endMin, breakStartMin: working.breakStartMin, breakEndMin: working.breakEndMin } : null,
    timeOff: timeOff.map<Interval>((t) => ({ start: t.startsAt, end: t.endsAt })),
    busy: appts.map<Interval>((a) => ({ start: a.startsAt, end: new Date(a.endsAt.getTime() + shop.bufferMinutes * 60000) })),
    durationMin,
    stepMin: shop.slotStepMinutes,
    bufferMin: shop.bufferMinutes,
    minAdvanceMinutes: q.ignoreMinAdvance ? 0 : shop.minAdvanceMinutes,
    maxAdvanceDays: shop.maxAdvanceDays,
  };
  const reason = dayUnavailableReason(rules);
  const slots = generateSlots(rules);
  const reasonText =
    reason === "HOLIDAY" ? `Feriado: ${holiday?.name}` :
    reason === "CLOSED" ? "Barbearia fechada neste dia" :
    reason === "NOT_WORKING" ? "Profissional não atende neste dia" :
    reason === "OUT_OF_RANGE" ? `Agendamentos disponíveis para os próximos ${shop.maxAdvanceDays} dias` :
    slots.length === 0 ? (timeOff.length ? "Profissional indisponível nesta data" : "Sem horários livres nesta data") : null;
  return { slots, reason: reasonText, durationMin };
}

// ─── Criação ─────────────────────────────────────────────────────────────────

export const createAppointmentSchema = z.object({
  barberProfileId: z.string().min(1),
  serviceId: z.string().min(1),
  date: dateSchema,
  startMin: z.coerce.number().int().min(0).max(24 * 60),
  clientUserId: z.string().optional(),
  clientNote: z.string().max(500).optional().default(""),
});

async function lockSlots(tx: Tx, appointmentId: string, barberProfileId: string, start: Date, end: Date, bufferMin: number) {
  const units = slotUnits(start, new Date(end.getTime() + bufferMin * 60000));
  // createMany não é usado para manter compatibilidade com SQLite + detecção de conflito
  for (const slotStart of units) {
    await tx.appointmentSlot.create({ data: { appointmentId, barberProfileId, slotStart } });
  }
}

const SLOT_TAKEN = "Este horário acabou de ser reservado por outra pessoa. Escolha outro horário.";

export async function createAppointment(actor: Actor, raw: z.input<typeof createAppointmentSchema>, now = new Date()) {
  const input = createAppointmentSchema.parse(raw);
  const admin = isAdmin(actor);
  const clientUserId = input.clientUserId && input.clientUserId !== actor.userId ? input.clientUserId : actor.userId;
  if (clientUserId !== actor.userId && !admin) throw forbidden("Apenas o proprietário pode agendar para outro cliente.");
  if (clientUserId === actor.userId && !actor.roles.includes("CLIENT")) throw forbidden("Ative o Modo Cliente para agendar.");
  if (actor.barberProfileId && actor.barberProfileId === input.barberProfileId && clientUserId === actor.userId) {
    throw new DomainError("Você não pode agendar um atendimento consigo mesmo.");
  }

  const shop = await prisma.shop.findUniqueOrThrow({ where: { id: actor.shopId } });
  const barber = await getBookableBarber(shop.id, input.barberProfileId);
  const svc = await resolveBarberService(barber.id, input.serviceId);
  const client = await prisma.user.findUnique({ where: { id: clientUserId } });
  if (!client || client.anonymizedAt) throw notFound("Cliente não encontrado.");
  if (clientUserId !== actor.userId) {
    const isClient = await prisma.roleAssignment.findFirst({ where: { userId: clientUserId, shopId: shop.id, role: "CLIENT" } });
    if (!isClient) throw notFound("Cliente não encontrado neste estabelecimento.");
  }

  const { slots } = await getAvailability({ shopId: shop.id, barberProfileId: barber.id, durationMin: svc.durationMin, date: input.date, now, ignoreMinAdvance: admin && clientUserId !== actor.userId });
  const slot = slots.find((s) => s.startMin === input.startMin);
  if (!slot) throw new DomainError("Horário indisponível. Atualize a agenda e escolha outro horário.", "CONFLICT");

  const station = await prisma.station.findFirst({ where: { barberProfileId: barber.id, isPublished: true } });
  const status: AppointmentStatus = shop.autoConfirm ? "CONFIRMED" : "PENDING";

  try {
    const appt = await prisma.$transaction(async (tx) => {
      const created = await tx.appointment.create({
        data: {
          shopId: shop.id,
          clientUserId,
          barberProfileId: barber.id,
          serviceId: svc.serviceId,
          stationId: station?.id ?? null,
          startsAt: slot.start,
          endsAt: slot.end,
          priceCents: svc.priceCents,
          durationMin: svc.durationMin,
          status,
          clientNote: input.clientNote,
          createdById: actor.userId,
        },
      });
      await lockSlots(tx, created.id, barber.id, slot.start, slot.end, shop.bufferMinutes);
      await tx.appointmentEvent.create({
        data: { appointmentId: created.id, actorUserId: actor.userId, action: "CREATED", toStatus: status },
      });
      const when = formatDateTime(slot.start, shop.timezone);
      await notify({
        userId: clientUserId,
        type: status === "CONFIRMED" ? "APPOINTMENT_CONFIRMED" : "APPOINTMENT_CREATED",
        title: status === "CONFIRMED" ? "Agendamento confirmado" : "Agendamento recebido",
        body: `${svc.name} com ${barber.displayName} — ${when}.`,
        link: "/cliente/agendamentos",
        dedupeKey: `appt-created:${created.id}`,
      }, tx);
      if (barber.userId) {
        await notify({
          userId: barber.userId,
          type: "APPOINTMENT_CREATED",
          title: "Novo agendamento",
          body: `${client.name} — ${svc.name} em ${when}.`,
          link: "/barbeiro/agenda",
          dedupeKey: `appt-created-barber:${created.id}`,
        }, tx);
      }
      return created;
    });
    return appt;
  } catch (err) {
    if (isUniqueViolation(err)) throw new DomainError(SLOT_TAKEN, "CONFLICT");
    throw err;
  }
}

// ─── Leitura com permissão ───────────────────────────────────────────────────

async function loadForActor(actor: Actor, id: string) {
  const appt = await prisma.appointment.findFirst({
    where: { id, shopId: actor.shopId },
    include: { barber: true, service: true, client: { select: { id: true, name: true } } },
  });
  if (!appt) throw notFound("Agendamento não encontrado.");
  const own = appt.clientUserId === actor.userId;
  const ownBarber = actor.barberProfileId !== null && appt.barberProfileId === actor.barberProfileId;
  if (!own && !ownBarber && !isAdmin(actor)) throw notFound("Agendamento não encontrado.");
  return { appt, own, ownBarber, admin: isAdmin(actor) };
}

function assertClientPolicy(startsAt: Date, policyHours: number, now: Date) {
  if (startsAt.getTime() - now.getTime() < policyHours * 3600000) {
    throw new DomainError(`Alterações e cancelamentos pelo cliente são permitidos até ${policyHours}h antes do horário. Entre em contato com a barbearia.`);
  }
}

// ─── Cancelamento ────────────────────────────────────────────────────────────

export async function cancelAppointment(actor: Actor, id: string, reason = "", now = new Date()) {
  const { appt, own, ownBarber, admin } = await loadForActor(actor, id);
  const shop = await prisma.shop.findUniqueOrThrow({ where: { id: actor.shopId } });
  if (!ACTIVE_STATUSES.includes(appt.status as AppointmentStatus) || appt.status === "IN_PROGRESS") {
    throw new DomainError("Este agendamento não pode mais ser cancelado.");
  }
  if (own && !admin && !ownBarber) assertClientPolicy(appt.startsAt, shop.cancelPolicyHours, now);

  await prisma.$transaction(async (tx) => {
    const res = await tx.appointment.updateMany({
      where: { id, status: appt.status },
      data: { status: "CANCELLED", cancelReason: reason.slice(0, 300) },
    });
    if (res.count === 0) throw new DomainError("O agendamento foi alterado por outra pessoa. Atualize a página.", "CONFLICT");
    await tx.appointmentSlot.deleteMany({ where: { appointmentId: id } });
    await tx.appointmentEvent.create({
      data: { appointmentId: id, actorUserId: actor.userId, action: "CANCELLED", fromStatus: appt.status, toStatus: "CANCELLED", note: reason.slice(0, 300) },
    });
    const when = formatDateTime(appt.startsAt, shop.timezone);
    const by = own ? "pelo cliente" : ownBarber ? "pelo profissional" : "pela barbearia";
    if (!own || admin) {
      await notify({ userId: appt.clientUserId, type: "APPOINTMENT_CANCELLED", title: "Agendamento cancelado", body: `${appt.service.name} em ${when} foi cancelado ${by}.${reason ? ` Motivo: ${reason}` : ""}`, link: "/cliente/agendamentos", dedupeKey: `appt-cancel:${id}:client` }, tx);
    }
    if (appt.barber.userId && appt.barber.userId !== actor.userId) {
      await notify({ userId: appt.barber.userId, type: "APPOINTMENT_CANCELLED", title: "Atendimento cancelado", body: `${appt.client.name} — ${appt.service.name} em ${when} (cancelado ${by}).`, link: "/barbeiro/agenda", dedupeKey: `appt-cancel:${id}:barber` }, tx);
    }
  });
}

// ─── Remarcação ──────────────────────────────────────────────────────────────

export const rescheduleSchema = z.object({
  date: dateSchema,
  startMin: z.coerce.number().int().min(0).max(24 * 60),
  barberProfileId: z.string().optional(),
});

export async function rescheduleAppointment(actor: Actor, id: string, raw: z.input<typeof rescheduleSchema>, now = new Date()) {
  const input = rescheduleSchema.parse(raw);
  const { appt, own, ownBarber, admin } = await loadForActor(actor, id);
  const shop = await prisma.shop.findUniqueOrThrow({ where: { id: actor.shopId } });
  if (!["PENDING", "CONFIRMED"].includes(appt.status)) throw new DomainError("Somente agendamentos pendentes ou confirmados podem ser remarcados.");
  if (own && !admin && !ownBarber) assertClientPolicy(appt.startsAt, shop.cancelPolicyHours, now);

  const targetBarberId = input.barberProfileId ?? appt.barberProfileId;
  if (targetBarberId !== appt.barberProfileId && !admin) throw forbidden("Apenas o proprietário pode transferir o atendimento para outro profissional.");
  const barber = await getBookableBarber(shop.id, targetBarberId);
  const svc = await resolveBarberService(barber.id, appt.serviceId);
  const durationMin = targetBarberId === appt.barberProfileId ? appt.durationMin : svc.durationMin;

  const { slots } = await getAvailability({ shopId: shop.id, barberProfileId: barber.id, durationMin, date: input.date, excludeAppointmentId: id, now, ignoreMinAdvance: admin });
  const slot = slots.find((s) => s.startMin === input.startMin);
  if (!slot) throw new DomainError("Horário indisponível para remarcação.", "CONFLICT");
  const station = await prisma.station.findFirst({ where: { barberProfileId: barber.id, isPublished: true } });

  try {
    await prisma.$transaction(async (tx) => {
      const res = await tx.appointment.updateMany({
        where: { id, status: appt.status, startsAt: appt.startsAt },
        data: {
          startsAt: slot.start,
          endsAt: new Date(slot.start.getTime() + durationMin * 60000),
          barberProfileId: barber.id,
          stationId: station?.id ?? null,
          durationMin,
        },
      });
      if (res.count === 0) throw new DomainError("O agendamento foi alterado por outra pessoa. Atualize a página.", "CONFLICT");
      await tx.appointmentSlot.deleteMany({ where: { appointmentId: id } });
      await lockSlots(tx, id, barber.id, slot.start, new Date(slot.start.getTime() + durationMin * 60000), shop.bufferMinutes);
      await tx.appointmentEvent.create({
        data: {
          appointmentId: id,
          actorUserId: actor.userId,
          action: "RESCHEDULED",
          fromStatus: appt.status,
          toStatus: appt.status,
          note: `De ${formatDateTime(appt.startsAt, shop.timezone)} para ${formatDateTime(slot.start, shop.timezone)}${barber.id !== appt.barberProfileId ? ` com ${barber.displayName}` : ""}`,
        },
      });
      const when = formatDateTime(slot.start, shop.timezone);
      const key = `appt-resched:${id}:${slot.start.getTime()}`;
      await notify({ userId: appt.clientUserId, type: "APPOINTMENT_RESCHEDULED", title: "Horário alterado", body: `${appt.service.name} com ${barber.displayName} agora em ${when}.`, link: "/cliente/agendamentos", dedupeKey: `${key}:client` }, tx);
      for (const uid of new Set([appt.barber.userId, barber.userId])) {
        if (uid && uid !== actor.userId) {
          await notify({ userId: uid, type: "APPOINTMENT_RESCHEDULED", title: "Atendimento remarcado", body: `${appt.client.name} — ${appt.service.name} agora em ${when} com ${barber.displayName}.`, link: "/barbeiro/agenda", dedupeKey: `${key}:${uid}` }, tx);
        }
      }
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new DomainError(SLOT_TAKEN, "CONFLICT");
    throw err;
  }
}

// ─── Mudança de estado (confirmar / iniciar / concluir / não compareceu) ─────

export async function changeAppointmentStatus(actor: Actor, id: string, to: AppointmentStatus, note = "") {
  if (to === "CANCELLED") return cancelAppointment(actor, id, note);
  const { appt, ownBarber, admin } = await loadForActor(actor, id);
  if (!ownBarber && !admin) throw forbidden("Apenas o profissional responsável ou o proprietário pode alterar o estado.");
  const from = appt.status as AppointmentStatus;
  if (!STATUS_TRANSITIONS[from].includes(to)) {
    throw new DomainError(`Não é possível passar de "${APPOINTMENT_STATUS_LABEL[from]}" para "${APPOINTMENT_STATUS_LABEL[to]}".`);
  }
  if ((to === "IN_PROGRESS" || to === "COMPLETED" || to === "NO_SHOW") && appt.startsAt.getTime() - Date.now() > 30 * 60000) {
    throw new DomainError("Este atendimento ainda não começou.");
  }
  const shop = await prisma.shop.findUniqueOrThrow({ where: { id: actor.shopId } });

  await prisma.$transaction(async (tx) => {
    const res = await tx.appointment.updateMany({ where: { id, status: from }, data: { status: to } });
    if (res.count === 0) throw new DomainError("O agendamento foi alterado por outra pessoa. Atualize a página.", "CONFLICT");
    await tx.appointmentEvent.create({ data: { appointmentId: id, actorUserId: actor.userId, action: "STATUS_CHANGED", fromStatus: from, toStatus: to, note } });
    if (to === "COMPLETED") await createCommissionForAppointment(tx, id);
    if (to === "CONFIRMED") {
      await notify({ userId: appt.clientUserId, type: "APPOINTMENT_CONFIRMED", title: "Agendamento confirmado", body: `${appt.service.name} com ${appt.barber.displayName} — ${formatDateTime(appt.startsAt, shop.timezone)}.`, link: "/cliente/agendamentos", dedupeKey: `appt-confirm:${id}` }, tx);
    }
  });
}

/** Snapshot imutável da regra de comissão no momento da conclusão */
export async function createCommissionForAppointment(tx: Tx, appointmentId: string) {
  const existing = await tx.commission.findUnique({ where: { appointmentId } });
  if (existing) return existing;
  const appt = await tx.appointment.findUniqueOrThrow({ where: { id: appointmentId }, include: { barber: true } });
  const bs = await tx.barberService.findUnique({ where: { barberProfileId_serviceId: { barberProfileId: appt.barberProfileId, serviceId: appt.serviceId } } });
  const model = appt.barber.commissionModel as CommissionModel;
  const result = computeCommission({ model, baseCents: appt.priceCents, barberPercent: appt.barber.commissionPercent, servicePercent: bs?.commissionPercent });
  return tx.commission.create({
    data: {
      appointmentId,
      barberProfileId: appt.barberProfileId,
      baseCents: appt.priceCents,
      percent: result.percent,
      amountCents: result.amountCents,
      model,
      ruleSnapshot: JSON.stringify({ ...result, barberPercent: appt.barber.commissionPercent, servicePercent: bs?.commissionPercent ?? null, fixedFeeCents: appt.barber.fixedFeeCents }),
    },
  });
}

// ─── Lembretes ───────────────────────────────────────────────────────────────

/** Gera lembretes para atendimentos nas próximas `hoursAhead` horas (idempotente) */
export async function queueReminders(hoursAhead = 24) {
  const now = new Date();
  const upcoming = await prisma.appointment.findMany({
    where: { status: { in: ["PENDING", "CONFIRMED"] }, startsAt: { gt: now, lt: new Date(now.getTime() + hoursAhead * 3600000) } },
    include: { service: true, barber: true, shop: true },
  });
  let queued = 0;
  for (const a of upcoming) {
    const n = await notify({
      userId: a.clientUserId,
      type: "APPOINTMENT_REMINDER",
      title: "Lembrete de atendimento",
      body: `${a.service.name} com ${a.barber.displayName} — ${formatDateTime(a.startsAt, a.shop.timezone)}. ${a.shop.name}, ${a.shop.address}`,
      link: "/cliente/agendamentos",
      dedupeKey: `reminder:${a.id}:${a.startsAt.getTime()}`,
    });
    if (n) queued++;
  }
  return queued;
}

export async function logAppointmentAudit(actor: Actor, action: string, id: string, data?: unknown) {
  await audit({ shopId: actor.shopId, actorUserId: actor.userId, action, entity: "Appointment", entityId: id, data });
}
