import Link from "next/link";
import { CalendarCheck, CalendarDays, CalendarRange, CheckCircle2, Coins, Users, UserPlus, Wallet, XCircle, Scissors, Banknote } from "lucide-react";
import { requireRole } from "@/server/auth/session";
import { requireShop } from "@/server/shop";
import { prisma } from "@/server/db";
import { adminMetrics } from "@/server/services/metrics";
import { Card, CardTitle, PageHeader, StatCard, Badge, STATUS_TONE, Select, Input } from "@/components/ui/primitives";
import { BarChart, HBarList } from "@/components/ui/charts";
import { formatMoney } from "@/lib/utils";
import { addDays, formatDateTime, isValidDateStr, todayIn } from "@/lib/time";
import { APPOINTMENT_STATUS, APPOINTMENT_STATUS_LABEL, type AppointmentStatus } from "@/types/domain";

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const shop = await requireShop();
  await requireRole("ADMIN");
  const sp = await searchParams;
  const tz = shop.timezone;
  const today = todayIn(tz);
  const toDate = sp.to && isValidDateStr(sp.to) ? sp.to : today;
  const fromDate = sp.from && isValidDateStr(sp.from) ? sp.from : addDays(toDate, -29);
  const status = APPOINTMENT_STATUS.includes(sp.status as AppointmentStatus) ? (sp.status as AppointmentStatus) : undefined;
  const [m, barbers, services] = await Promise.all([
    adminMetrics({ shopId: shop.id, tz, fromDate, toDate, barberProfileId: sp.barber || undefined, serviceId: sp.service || undefined, status }),
    prisma.barberProfile.findMany({ where: { shopId: shop.id, status: { in: ["APPROVED", "INACTIVE"] } }, orderBy: { displayName: "asc" } }),
    prisma.service.findMany({ where: { shopId: shop.id }, orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <>
      <PageHeader eyebrow="Painel do proprietário" title="Dashboard" description="Indicadores calculados em tempo real a partir dos agendamentos, pagamentos e comissões registrados." />
      <form className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-line/70 bg-graphite/50 p-4" aria-label="Filtros">
        <label className="text-xs text-mist">De<Input type="date" name="from" defaultValue={fromDate} className="mt-1 h-9 w-[150px]" /></label>
        <label className="text-xs text-mist">Até<Input type="date" name="to" defaultValue={toDate} className="mt-1 h-9 w-[150px]" /></label>
        <label className="min-w-[150px] flex-1 text-xs text-mist">Profissional
          <Select name="barber" defaultValue={sp.barber ?? ""} className="mt-1 h-9"><option value="">Todos</option>{barbers.map((b) => <option key={b.id} value={b.id}>{b.displayName}</option>)}</Select>
        </label>
        <label className="min-w-[150px] flex-1 text-xs text-mist">Serviço
          <Select name="service" defaultValue={sp.service ?? ""} className="mt-1 h-9"><option value="">Todos</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
        </label>
        <label className="min-w-[150px] flex-1 text-xs text-mist">Estado
          <Select name="status" defaultValue={status ?? ""} className="mt-1 h-9"><option value="">Todos</option>{APPOINTMENT_STATUS.map((s) => <option key={s} value={s}>{APPOINTMENT_STATUS_LABEL[s]}</option>)}</Select>
        </label>
        <div className="flex gap-2">
          <button className="h-9 rounded-xl bg-gold px-4 text-sm font-medium text-ink hover:brightness-110">Aplicar</button>
          <Link href="/admin" className="inline-flex h-9 items-center rounded-xl border border-line px-3 text-xs text-mist hover:text-cream">Limpar</Link>
        </div>
      </form>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Agendamentos hoje" value={m.todayCount} icon={<CalendarCheck className="h-4 w-4" />} />
        <StatCard label="Nesta semana" value={m.weekCount} icon={<CalendarDays className="h-4 w-4" />} />
        <StatCard label="Neste mês" value={m.monthCount} icon={<CalendarRange className="h-4 w-4" />} />
      </div>
      <p className="mb-2 mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-smoke">Período filtrado</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Faturamento registrado" value={formatMoney(m.received)} hint={`Serviços concluídos: ${formatMoney(m.servicesValue)}`} icon={<Banknote className="h-4 w-4" />} tone="copper" />
        <StatCard label="Comissões" value={formatMoney(m.commissions)} hint={`Repasses pendentes (total): ${formatMoney(m.openCommission)}`} icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="Concluídos" value={m.completedCount} hint={`${m.periodCount} agendamento(s) ativos/concluídos`} icon={<CheckCircle2 className="h-4 w-4" />} tone="neutral" />
        <StatCard label="Cancelamentos" value={m.cancelledCount} hint={`${m.noShowCount} não compareceram`} icon={<XCircle className="h-4 w-4" />} tone="neutral" />
        <StatCard label="Clientes ativos (90 dias)" value={m.activeClients} icon={<Users className="h-4 w-4" />} tone="neutral" />
        <StatCard label="Novos clientes" value={m.newClients} icon={<UserPlus className="h-4 w-4" />} tone="neutral" />
        <StatCard label="Profissionais ativos" value={m.barberCount} icon={<Scissors className="h-4 w-4" />} tone="neutral" />
        <StatCard label="Ticket médio" value={m.completedCount ? formatMoney(Math.round(m.servicesValue / m.completedCount)) : "—"} icon={<Coins className="h-4 w-4" />} tone="neutral" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardTitle>Agendamentos por dia</CardTitle>
          <BarChart label="Agendamentos por dia" data={m.perDay.map((d) => ({ label: d.date.slice(8) + "/" + d.date.slice(5, 7), value: d.total }))} />
        </Card>
        <Card>
          <CardTitle>Serviços mais contratados</CardTitle>
          <HBarList data={m.topServices.map((s) => ({ label: s.name, value: s.count }))} />
        </Card>
        <Card>
          <CardTitle>Horários de maior movimento</CardTitle>
          <BarChart label="Agendamentos por hora" height={140} data={m.busyHours.map((h) => ({ label: `${h.hour}h`, value: h.count }))} />
        </Card>
        <Card>
          <CardTitle>Por profissional</CardTitle>
          <HBarList data={m.byBarber.map((b) => ({ label: b.name, value: b.count, hint: formatMoney(b.value) }))} />
        </Card>
      </div>

      <Card className="mt-6">
        <CardTitle action={<Link href="/admin/agendamentos" className="text-xs text-gold-soft">Ver agenda completa</Link>}>Próximos agendamentos</CardTitle>
        {m.upcoming.length === 0 ? <p className="text-sm text-smoke">Nenhum agendamento futuro.</p> : (
          <ul className="divide-y divide-line/60">
            {m.upcoming.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <span className="w-40 text-gold-soft">{formatDateTime(a.startsAt, tz)}</span>
                <span className="flex-1 text-cream">{a.client.name} <span className="text-smoke">· {a.service.name} · {a.barber.displayName}</span></span>
                <Badge tone={STATUS_TONE[a.status]}>{APPOINTMENT_STATUS_LABEL[a.status as AppointmentStatus]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
