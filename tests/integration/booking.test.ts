import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { createAppointment, cancelAppointment, rescheduleAppointment, getAvailability, changeAppointmentStatus } from "@/server/services/appointments";
import { updateCommission } from "@/server/services/team";
import { createTimeOff } from "@/server/services/team";
import { setupShop, newClient, nextTuesday, firstServiceOf } from "../helpers";
import { zonedToUtc } from "@/lib/time";

describe("agendamentos", () => {
  let ctx: Awaited<ReturnType<typeof setupShop>>;
  beforeEach(async () => {
    ctx = await setupShop();
  });

  it("cliente agenda com o barbeiro inicial e a reserva é persistida", async () => {
    const { actor } = await newClient(ctx.shop.id);
    const svc = await firstServiceOf(ctx.ownerBarber.id);
    const date = nextTuesday();
    const appt = await createAppointment(actor, { barberProfileId: ctx.ownerBarber.id, serviceId: svc.id, date, startMin: 600 });
    expect(appt.status).toBe("CONFIRMED");
    expect(appt.startsAt.toISOString()).toBe(zonedToUtc(date, 600, "America/Sao_Paulo").toISOString());
    expect(appt.priceCents).toBe(svc.priceCents);
    const station = await prisma.station.findFirst({ where: { barberProfileId: ctx.ownerBarber.id } });
    expect(appt.stationId).toBe(station?.id);
    const events = await prisma.appointmentEvent.findMany({ where: { appointmentId: appt.id } });
    expect(events[0]).toMatchObject({ action: "CREATED", toStatus: "CONFIRMED" });
    const notes = await prisma.notification.count({ where: { userId: actor.userId, type: "APPOINTMENT_CONFIRMED" } });
    expect(notes).toBe(1);
  });

  it("CONCORRÊNCIA: duas reservas simultâneas no mesmo horário → apenas uma é confirmada", async () => {
    const a = await newClient(ctx.shop.id, "Ana");
    const b = await newClient(ctx.shop.id, "Bruno");
    const c = await newClient(ctx.shop.id, "Caio");
    const svc = await firstServiceOf(ctx.ownerBarber.id);
    const date = nextTuesday();
    const input = { barberProfileId: ctx.ownerBarber.id, serviceId: svc.id, date, startMin: 660 };
    const results = await Promise.allSettled([createAppointment(a.actor, input), createAppointment(b.actor, input), createAppointment(c.actor, input)]);
    const ok = results.filter((r) => r.status === "fulfilled");
    expect(ok).toHaveLength(1);
    const count = await prisma.appointment.count({ where: { barberProfileId: ctx.ownerBarber.id, status: { not: "CANCELLED" } } });
    expect(count).toBe(1);
  });

  it("CONCORRÊNCIA: horários sobrepostos com inícios diferentes também são bloqueados", async () => {
    const a = await newClient(ctx.shop.id, "Ana");
    const b = await newClient(ctx.shop.id, "Bruno");
    const combo = await prisma.service.findFirstOrThrow({ where: { shopId: ctx.shop.id, name: "Corte + barba" } }); // 70 min
    const short = await prisma.service.findFirstOrThrow({ where: { shopId: ctx.shop.id, name: "Sobrancelha" } }); // 15 min
    const date = nextTuesday();
    const results = await Promise.allSettled([
      createAppointment(a.actor, { barberProfileId: ctx.ownerBarber.id, serviceId: combo.id, date, startMin: 900 }),
      createAppointment(b.actor, { barberProfileId: ctx.ownerBarber.id, serviceId: short.id, date, startMin: 945 }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("impede agendamento duplicado sequencial e libera o horário após cancelamento", async () => {
    const a = await newClient(ctx.shop.id, "Ana");
    const b = await newClient(ctx.shop.id, "Bruno");
    const svc = await firstServiceOf(ctx.ownerBarber.id);
    const date = nextTuesday();
    const input = { barberProfileId: ctx.ownerBarber.id, serviceId: svc.id, date, startMin: 540 };
    const appt = await createAppointment(a.actor, input);
    await expect(createAppointment(b.actor, input)).rejects.toThrow(/indisponível|reservado/);
    await cancelAppointment(a.actor, appt.id, "imprevisto");
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })).status).toBe("CANCELLED");
    expect(await prisma.appointmentSlot.count({ where: { appointmentId: appt.id } })).toBe(0);
    const again = await createAppointment(b.actor, input);
    expect(again.status).toBe("CONFIRMED");
  });

  it("remarcação revalida a agenda no servidor e registra histórico", async () => {
    const a = await newClient(ctx.shop.id, "Ana");
    const b = await newClient(ctx.shop.id, "Bruno");
    const svc = await firstServiceOf(ctx.ownerBarber.id);
    const date = nextTuesday();
    const appt = await createAppointment(a.actor, { barberProfileId: ctx.ownerBarber.id, serviceId: svc.id, date, startMin: 600 });
    await createAppointment(b.actor, { barberProfileId: ctx.ownerBarber.id, serviceId: svc.id, date, startMin: 780 });
    await expect(rescheduleAppointment(a.actor, appt.id, { date, startMin: 780 })).rejects.toThrow(/indisponível/i);
    await rescheduleAppointment(a.actor, appt.id, { date, startMin: 840 });
    const updated = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } });
    expect(updated.startsAt.toISOString()).toBe(zonedToUtc(date, 840, "America/Sao_Paulo").toISOString());
    // horário antigo liberado
    const { slots } = await getAvailability({ shopId: ctx.shop.id, barberProfileId: ctx.ownerBarber.id, serviceId: svc.id, date });
    expect(slots.map((s) => s.startMin)).toContain(600);
    const ev = await prisma.appointmentEvent.findFirst({ where: { appointmentId: appt.id, action: "RESCHEDULED" } });
    expect(ev?.actorUserId).toBe(a.actor.userId);
  });

  it("cliente não pode cancelar nem remarcar reserva de outra pessoa", async () => {
    const a = await newClient(ctx.shop.id, "Ana");
    const intruder = await newClient(ctx.shop.id, "Intruso");
    const svc = await firstServiceOf(ctx.ownerBarber.id);
    const date = nextTuesday();
    const appt = await createAppointment(a.actor, { barberProfileId: ctx.ownerBarber.id, serviceId: svc.id, date, startMin: 600 });
    await expect(cancelAppointment(intruder.actor, appt.id)).rejects.toThrow(/não encontrado/);
    await expect(rescheduleAppointment(intruder.actor, appt.id, { date, startMin: 660 })).rejects.toThrow(/não encontrado/);
    await expect(changeAppointmentStatus(a.actor, appt.id, "COMPLETED")).rejects.toThrow(/responsável|proprietário/);
  });

  it("política de cancelamento: cliente não cancela em cima da hora", async () => {
    const a = await newClient(ctx.shop.id, "Ana");
    const svc = await firstServiceOf(ctx.ownerBarber.id);
    const date = nextTuesday();
    const appt = await createAppointment(a.actor, { barberProfileId: ctx.ownerBarber.id, serviceId: svc.id, date, startMin: 600 });
    const almost = new Date(appt.startsAt.getTime() - 30 * 60000);
    await expect(cancelAppointment(a.actor, appt.id, "", almost)).rejects.toThrow(/até 2h antes/);
    await cancelAppointment(ctx.ownerActor, appt.id, "barbearia"); // proprietário pode
  });

  it("folga do profissional remove horários e não permite reservar", async () => {
    const a = await newClient(ctx.shop.id, "Ana");
    const svc = await firstServiceOf(ctx.ownerBarber.id);
    const date = nextTuesday();
    await createTimeOff(ctx.ownerActor, { barberProfileId: ctx.ownerBarber.id, kind: "DAY_OFF", startDate: date, endDate: date, reason: "consulta" });
    const { slots, reason } = await getAvailability({ shopId: ctx.shop.id, barberProfileId: ctx.ownerBarber.id, serviceId: svc.id, date });
    expect(slots).toHaveLength(0);
    expect(reason).toMatch(/indisponível/);
    await expect(createAppointment(a.actor, { barberProfileId: ctx.ownerBarber.id, serviceId: svc.id, date, startMin: 600 })).rejects.toThrow();
  });

  it("feriado configurado bloqueia o dia", async () => {
    const svc = await firstServiceOf(ctx.ownerBarber.id);
    const date = nextTuesday();
    await prisma.holiday.create({ data: { shopId: ctx.shop.id, date, name: "Feriado municipal" } });
    const { slots, reason } = await getAvailability({ shopId: ctx.shop.id, barberProfileId: ctx.ownerBarber.id, serviceId: svc.id, date });
    expect(slots).toHaveLength(0);
    expect(reason).toContain("Feriado");
  });

  it("concluir atendimento gera comissão com snapshot imutável", async () => {
    const a = await newClient(ctx.shop.id, "Ana");
    await updateCommission(ctx.ownerActor, ctx.ownerBarber.id, { commissionModel: "PERCENT", commissionPercent: 50, fixedFeeCents: 0, partnershipType: "COMISSIONADO" });
    const svc = await prisma.service.findFirstOrThrow({ where: { shopId: ctx.shop.id, name: "Corte masculino" } }); // R$ 50
    const appt = await createAppointment(a.actor, { barberProfileId: ctx.ownerBarber.id, serviceId: svc.id, date: nextTuesday(), startMin: 600 });
    await prisma.appointment.update({ where: { id: appt.id }, data: { startsAt: new Date(Date.now() - 60 * 60000), endsAt: new Date(Date.now() - 20 * 60000) } });
    await changeAppointmentStatus(ctx.ownerActor, appt.id, "IN_PROGRESS");
    await changeAppointmentStatus(ctx.ownerActor, appt.id, "COMPLETED");
    const commission = await prisma.commission.findUniqueOrThrow({ where: { appointmentId: appt.id } });
    expect(commission.amountCents).toBe(2500);
    await updateCommission(ctx.ownerActor, ctx.ownerBarber.id, { commissionModel: "PERCENT", commissionPercent: 70, fixedFeeCents: 0, partnershipType: "COMISSIONADO" });
    const after = await prisma.commission.findUniqueOrThrow({ where: { appointmentId: appt.id } });
    expect(after.amountCents).toBe(2500); // não recalcula retroativamente
    await expect(changeAppointmentStatus(ctx.ownerActor, appt.id, "CANCELLED")).rejects.toThrow();
  });

  it("transições de estado inválidas são rejeitadas", async () => {
    const a = await newClient(ctx.shop.id, "Ana");
    const svc = await firstServiceOf(ctx.ownerBarber.id);
    const appt = await createAppointment(a.actor, { barberProfileId: ctx.ownerBarber.id, serviceId: svc.id, date: nextTuesday(), startMin: 600 });
    await expect(changeAppointmentStatus(ctx.ownerActor, appt.id, "COMPLETED")).rejects.toThrow(/ainda não começou/);
    await expect(changeAppointmentStatus(ctx.ownerActor, appt.id, "PENDING")).rejects.toThrow(/Não é possível/);
  });
});
