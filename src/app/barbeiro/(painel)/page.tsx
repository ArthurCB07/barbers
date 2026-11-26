import Link from "next/link";
import { CalendarClock, CheckCircle2, Clock, Coins, TrendingUp, Wallet } from "lucide-react";
import { requireRole } from "@/server/auth/session";
import { requireShop } from "@/server/shop";
import { prisma } from "@/server/db";
import { barberMetrics } from "@/server/services/metrics";
import { getAvailability } from "@/server/services/appointments";
import { Card, CardTitle, EmptyState, PageHeader, StatCard, LinkButton, Badge, STATUS_TONE } from "@/components/ui/primitives";
import { AppointmentActions } from "@/features/appointments/AppointmentActions";
import { toActionable } from "@/features/appointments/mapping";
import { formatMoney } from "@/lib/utils";
import { formatDateTime, formatTime, todayIn } from "@/lib/time";
import { APPOINTMENT_STATUS_LABEL, type AppointmentStatus } from "@/types/domain";

export default async function BarberDashboard() {
  const shop = await requireShop();
  const s = await requireRole("BARBER");
  const barberId = s.actor.barberProfileId!;
  const today = todayIn(shop.timezone);
  const [m, profile, minService] = await Promise.all([
    barberMetrics(shop.id, shop.timezone, barberId),
    prisma.barberProfile.findUniqueOrThrow({ where: { id: barberId }, include: { station: true } }),
    prisma.barberService.findFirst({ where: { barberProfileId: barberId, active: true }, include: { service: true }, orderBy: { service: { durationMin: "asc" } } }),
  ]);
  const free = minService ? await getAvailability({ shopId: shop.id, barberProfileId: barberId, serviceId: minService.serviceId, date: today }) : null;
  const todayFull = await prisma.appointment.findMany({ where: { id: { in: m.todayAppts.map((a) => a.id) } }, include: { barber: true, service: true, client: { select: { name: true } } }, orderBy: { startsAt: "asc" } });

  return (
    <>
      <PageHeader eyebrow="Painel profissional" title={profile.displayName} description={profile.station ? `${profile.station.name} · barbearia ${shop.name}` : "Sem estação 3D atribuída — fale com o proprietário."} actions={<LinkButton href="/barbeiro/agenda" variant="outline">Abrir agenda</LinkButton>} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Atendimentos hoje" value={m.todayAppts.length} icon={<CalendarClock className="h-4 w-4" />} hint={`${m.todayAppts.filter((a) => a.status === "COMPLETED").length} concluído(s)`} />
        <StatCard label="Horários livres hoje" value={free ? free.slots.length : "—"} icon={<Clock className="h-4 w-4" />} hint={free?.reason ?? (minService ? `para ${minService.service.name}` : "Configure seus serviços")} />
        <StatCard label="Gerado no mês" value={formatMoney(m.monthValue)} icon={<TrendingUp className="h-4 w-4" />} hint={`${m.monthCompletedCount} serviço(s) concluído(s)`} tone="copper" />
        <StatCard label="Comissão a receber" value={formatMoney(m.openCommission)} icon={<Wallet className="h-4 w-4" />} hint={`No mês: ${formatMoney(m.commissionMonth)}`} />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <StatCard label="Total de serviços realizados" value={m.completedTotal} icon={<CheckCircle2 className="h-4 w-4" />} tone="neutral" />
        <StatCard label="Repasses recebidos" value={formatMoney(m.paidOut)} icon={<Coins className="h-4 w-4" />} tone="neutral" />
        <StatCard label="Taxa de comparecimento (mês)" value={m.completionRate == null ? "—" : `${m.completionRate}%`} tone="neutral" hint="concluídos ÷ (concluídos + faltas + cancelados)" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardTitle>Agenda de hoje</CardTitle>
          {todayFull.length === 0 ? (
            <EmptyState title="Nenhum atendimento hoje" description="Aproveite para revisar sua disponibilidade." />
          ) : (
            <ul className="space-y-2">
              {todayFull.map((a) => (
                <li key={a.id} className="flex flex-col gap-3 rounded-xl border border-line/60 bg-coal/40 p-3 sm:flex-row sm:items-center">
                  <div className="w-24 shrink-0 font-display text-2xl text-gold-soft">{formatTime(a.startsAt, shop.timezone)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-cream">{a.client.name}</p>
                    <p className="text-xs text-smoke">{a.service.name} · {formatMoney(a.priceCents)}</p>
                    <Badge tone={STATUS_TONE[a.status]} className="mt-1">{APPOINTMENT_STATUS_LABEL[a.status as AppointmentStatus]}</Badge>
                  </div>
                  <AppointmentActions a={toActionable(a, { role: "BARBER", policyHours: shop.cancelPolicyHours })} today={today} maxAdvanceDays={shop.maxAdvanceDays} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardTitle>Próximo atendimento</CardTitle>
          {m.next ? (
            <div>
              <p className="font-display text-3xl text-cream">{formatDateTime(m.next.startsAt, shop.timezone)}</p>
              <p className="mt-1 text-sm text-mist">{m.next.client.name} · {m.next.service.name}</p>
              <Link href="/barbeiro/clientes" className="mt-3 inline-block text-xs text-gold-soft">Ver ficha do cliente</Link>
            </div>
          ) : (
            <p className="text-sm text-smoke">Nenhum atendimento futuro agendado.</p>
          )}
        </Card>
      </div>
    </>
  );
}
