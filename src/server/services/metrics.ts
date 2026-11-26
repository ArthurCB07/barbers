/** Indicadores do dashboard — calculados exclusivamente a partir do banco */
import { prisma } from "../db";
import { addDays, toZoned, zonedToUtc, todayIn } from "@/lib/time";
import type { AppointmentStatus } from "@/types/domain";

export interface MetricsFilter {
  shopId: string;
  tz: string;
  fromDate: string; // YYYY-MM-DD inclusive
  toDate: string; // YYYY-MM-DD inclusive
  barberProfileId?: string;
  serviceId?: string;
  status?: AppointmentStatus;
}

export async function adminMetrics(f: MetricsFilter) {
  const from = zonedToUtc(f.fromDate, 0, f.tz);
  const to = zonedToUtc(addDays(f.toDate, 1), 0, f.tz);
  const scope = {
    shopId: f.shopId,
    ...(f.barberProfileId ? { barberProfileId: f.barberProfileId } : {}),
    ...(f.serviceId ? { serviceId: f.serviceId } : {}),
  };
  const today = todayIn(f.tz);
  const todayStart = zonedToUtc(today, 0, f.tz);
  const todayEnd = zonedToUtc(addDays(today, 1), 0, f.tz);
  const weekday = toZoned(new Date(), f.tz).weekday;
  const weekStart = zonedToUtc(addDays(today, -((weekday + 6) % 7)), 0, f.tz);
  const monthStart = zonedToUtc(`${today.slice(0, 7)}-01`, 0, f.tz);
  const notCancelled = { status: { notIn: ["CANCELLED"] } };

  const [appts, todayCount, weekCount, monthCount, newClients, activeClientsRows, barberCount, payments, commissions, openCommission, upcoming] = await Promise.all([
    prisma.appointment.findMany({
      where: { ...scope, startsAt: { gte: from, lt: to }, ...(f.status ? { status: f.status } : {}) },
      include: { service: true, barber: true },
    }),
    prisma.appointment.count({ where: { ...scope, ...notCancelled, startsAt: { gte: todayStart, lt: todayEnd } } }),
    prisma.appointment.count({ where: { ...scope, ...notCancelled, startsAt: { gte: weekStart, lt: addDaysUtc(weekStart, 7) } } }),
    prisma.appointment.count({ where: { ...scope, ...notCancelled, startsAt: { gte: monthStart, lt: addMonth(monthStart) } } }),
    prisma.roleAssignment.count({ where: { shopId: f.shopId, role: "CLIENT", createdAt: { gte: from, lt: to } } }),
    prisma.appointment.findMany({ where: { shopId: f.shopId, startsAt: { gte: addDaysUtc(new Date(), -90) }, status: { in: ["COMPLETED", "CONFIRMED", "PENDING", "IN_PROGRESS"] } }, select: { clientUserId: true }, distinct: ["clientUserId"] }),
    prisma.barberProfile.count({ where: { shopId: f.shopId, status: "APPROVED" } }),
    prisma.payment.findMany({ where: { status: "CONFIRMED", appointment: { ...scope, startsAt: { gte: from, lt: to } } }, select: { amountCents: true } }),
    prisma.commission.findMany({ where: { appointment: { ...scope, startsAt: { gte: from, lt: to } } }, select: { amountCents: true } }),
    prisma.commission.aggregate({ where: { status: "OPEN", barber: { shopId: f.shopId }, ...(f.barberProfileId ? { barberProfileId: f.barberProfileId } : {}) }, _sum: { amountCents: true } }),
    prisma.appointment.findMany({
      where: { ...scope, status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS"] }, startsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
      take: 8,
      include: { service: true, barber: true, client: { select: { name: true } } },
    }),
  ]);

  const completed = appts.filter((a) => a.status === "COMPLETED");
  const cancelled = appts.filter((a) => a.status === "CANCELLED");
  const servicesValue = completed.reduce((s, a) => s + a.priceCents, 0);

  // Série diária
  const days: string[] = [];
  for (let d = f.fromDate; d <= f.toDate && days.length < 92; d = addDays(d, 1)) days.push(d);
  const perDay = new Map(days.map((d) => [d, { date: d, total: 0, completed: 0, value: 0 }]));
  for (const a of appts) {
    if (a.status === "CANCELLED") continue;
    const z = toZoned(a.startsAt, f.tz);
    const row = perDay.get(z.date);
    if (!row) continue;
    row.total++;
    if (a.status === "COMPLETED") {
      row.completed++;
      row.value += a.priceCents;
    }
  }

  // Serviços mais contratados
  const svc = new Map<string, { name: string; count: number }>();
  for (const a of appts) {
    if (a.status === "CANCELLED") continue;
    const r = svc.get(a.serviceId) ?? { name: a.service.name, count: 0 };
    r.count++;
    svc.set(a.serviceId, r);
  }

  // Horários de maior movimento
  const hours = new Map<number, number>();
  for (const a of appts) {
    if (a.status === "CANCELLED") continue;
    const h = toZoned(a.startsAt, f.tz).hour;
    hours.set(h, (hours.get(h) ?? 0) + 1);
  }

  // Por profissional
  const byBarber = new Map<string, { name: string; count: number; value: number }>();
  for (const a of appts) {
    if (a.status === "CANCELLED") continue;
    const r = byBarber.get(a.barberProfileId) ?? { name: a.barber.displayName, count: 0, value: 0 };
    r.count++;
    if (a.status === "COMPLETED") r.value += a.priceCents;
    byBarber.set(a.barberProfileId, r);
  }

  return {
    todayCount,
    weekCount,
    monthCount,
    periodCount: appts.filter((a) => a.status !== "CANCELLED").length,
    completedCount: completed.length,
    cancelledCount: cancelled.length,
    noShowCount: appts.filter((a) => a.status === "NO_SHOW").length,
    newClients,
    activeClients: activeClientsRows.length,
    barberCount,
    servicesValue,
    received: payments.reduce((s, p) => s + p.amountCents, 0),
    commissions: commissions.reduce((s, c) => s + c.amountCents, 0),
    openCommission: openCommission._sum.amountCents ?? 0,
    perDay: [...perDay.values()],
    topServices: [...svc.values()].sort((a, b) => b.count - a.count).slice(0, 6),
    busyHours: Array.from({ length: 15 }, (_, i) => i + 7).map((h) => ({ hour: h, count: hours.get(h) ?? 0 })),
    byBarber: [...byBarber.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.count - a.count),
    upcoming,
  };
}

function addDaysUtc(d: Date, n: number) {
  return new Date(d.getTime() + n * 86400000);
}
function addMonth(d: Date) {
  const n = new Date(d);
  n.setUTCMonth(n.getUTCMonth() + 1);
  return n;
}

/** Indicadores do painel do barbeiro */
export async function barberMetrics(shopId: string, tz: string, barberProfileId: string) {
  const today = todayIn(tz);
  const todayStart = zonedToUtc(today, 0, tz);
  const todayEnd = zonedToUtc(addDays(today, 1), 0, tz);
  const monthStart = zonedToUtc(`${today.slice(0, 7)}-01`, 0, tz);
  const [todayAppts, next, completedTotal, monthCompleted, commissionMonth, openCommission, paidOut] = await Promise.all([
    prisma.appointment.findMany({ where: { barberProfileId, startsAt: { gte: todayStart, lt: todayEnd }, status: { not: "CANCELLED" } }, orderBy: { startsAt: "asc" }, include: { service: true, client: { select: { name: true } } } }),
    prisma.appointment.findFirst({ where: { barberProfileId, startsAt: { gte: new Date() }, status: { in: ["PENDING", "CONFIRMED"] } }, orderBy: { startsAt: "asc" }, include: { service: true, client: { select: { name: true } } } }),
    prisma.appointment.count({ where: { barberProfileId, status: "COMPLETED" } }),
    prisma.appointment.findMany({ where: { barberProfileId, status: "COMPLETED", startsAt: { gte: monthStart } }, select: { priceCents: true } }),
    prisma.commission.aggregate({ where: { barberProfileId, appointment: { startsAt: { gte: monthStart } } }, _sum: { amountCents: true } }),
    prisma.commission.aggregate({ where: { barberProfileId, status: "OPEN" }, _sum: { amountCents: true } }),
    prisma.payout.aggregate({ where: { barberProfileId }, _sum: { amountCents: true } }),
  ]);
  const monthAll = await prisma.appointment.count({ where: { barberProfileId, startsAt: { gte: monthStart, lt: new Date() }, status: { in: ["COMPLETED", "NO_SHOW", "CANCELLED"] } } });
  return {
    todayAppts,
    next,
    completedTotal,
    monthValue: monthCompleted.reduce((s, a) => s + a.priceCents, 0),
    monthCompletedCount: monthCompleted.length,
    commissionMonth: commissionMonth._sum.amountCents ?? 0,
    openCommission: openCommission._sum.amountCents ?? 0,
    paidOut: paidOut._sum.amountCents ?? 0,
    completionRate: monthAll ? Math.round((monthCompleted.length / monthAll) * 100) : null,
  };
}
