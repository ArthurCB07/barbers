import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { prisma } from "@/server/db";
import { getAvailability } from "@/server/services/appointments";
import { Badge, Card, STATUS_TONE } from "@/components/ui/primitives";
import { AppointmentActions } from "./AppointmentActions";
import { toActionable } from "./mapping";
import { addDays, formatLongDate, formatTime, toZoned, weekdayOf, zonedToUtc, WEEKDAY_SHORT, todayIn, isValidDateStr } from "@/lib/time";
import { cn, formatMoney } from "@/lib/utils";
import { APPOINTMENT_STATUS_LABEL, TIME_OFF_LABEL, type AppointmentStatus, type TimeOffKind } from "@/types/domain";

type View = "day" | "week" | "month";

interface Props {
  shop: { id: string; timezone: string; cancelPolicyHours: number; maxAdvanceDays: number };
  barberProfileId?: string;
  view: View;
  date: string;
  basePath: string;
  role: "BARBER" | "ADMIN";
  extraQuery?: Record<string, string>;
}

export function parseAgendaParams(sp: { view?: string; date?: string }, tz: string): { view: View; date: string } {
  const view: View = sp.view === "week" || sp.view === "month" ? sp.view : "day";
  const date = sp.date && isValidDateStr(sp.date) ? sp.date : todayIn(tz);
  return { view, date };
}

export async function AgendaBoard({ shop, barberProfileId, view, date, basePath, role, extraQuery = {} }: Props) {
  const tz = shop.timezone;
  let start = date;
  let days = 1;
  if (view === "week") {
    start = addDays(date, -((weekdayOf(date) + 6) % 7));
    days = 7;
  } else if (view === "month") {
    start = `${date.slice(0, 7)}-01`;
    const [y, m] = date.split("-").map(Number);
    days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  }
  const from = zonedToUtc(start, 0, tz);
  const to = zonedToUtc(addDays(start, days), 0, tz);
  const [appts, timeOff] = await Promise.all([
    prisma.appointment.findMany({
      where: { shopId: shop.id, startsAt: { gte: from, lt: to }, ...(barberProfileId ? { barberProfileId } : {}), ...(view === "month" ? {} : {}) },
      orderBy: { startsAt: "asc" },
      include: { barber: true, service: true, client: { select: { name: true, phone: true } }, station: true },
    }),
    prisma.timeOff.findMany({ where: { startsAt: { lt: to }, endsAt: { gt: from }, status: "APPROVED", ...(barberProfileId ? { barberProfileId } : { barber: { shopId: shop.id } }) }, include: { barber: true } }),
  ]);

  const step = view === "day" ? 1 : view === "week" ? 7 : 30;
  const prev = view === "month" ? `${addDays(start, -1).slice(0, 7)}-01` : addDays(date, -step);
  const next = view === "month" ? addDays(start, days) : addDays(date, step);
  const q = (o: Record<string, string>) => `${basePath}?${new URLSearchParams({ ...extraQuery, view, date, ...o })}`;
  const today = todayIn(tz);

  const header = (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-1">
        <Link href={q({ date: prev })} className="rounded-lg p-2 text-mist hover:bg-white/5" aria-label="Período anterior"><ChevronLeft className="h-4 w-4" /></Link>
        <Link href={q({ date: today })} className="rounded-lg border border-line px-3 py-1.5 text-xs text-mist hover:text-cream">Hoje</Link>
        <Link href={q({ date: next })} className="rounded-lg p-2 text-mist hover:bg-white/5" aria-label="Próximo período"><ChevronRight className="h-4 w-4" /></Link>
        <p className="ml-2 font-display text-xl text-cream">
          {view === "day" ? formatLongDate(date, tz) : view === "week" ? `Semana de ${formatLongDate(start, tz)}` : new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: tz }).format(zonedToUtc(start, 720, tz))}
        </p>
      </div>
      <div className="flex rounded-xl border border-line bg-coal/60 p-1 text-xs" role="tablist" aria-label="Visualização">
        {(["day", "week", "month"] as View[]).map((v) => (
          <Link key={v} role="tab" aria-selected={v === view} href={q({ view: v })} className={cn("rounded-lg px-3 py-1.5", v === view ? "bg-gold text-ink" : "text-mist hover:text-cream")}>
            {v === "day" ? "Dia" : v === "week" ? "Semana" : "Mês"}
          </Link>
        ))}
      </div>
    </div>
  );

  if (view === "month") {
    const firstWeekday = (weekdayOf(start) + 6) % 7;
    const cells = Array.from({ length: firstWeekday + days }, (_, i) => (i < firstWeekday ? null : addDays(start, i - firstWeekday)));
    return (
      <Card>
        {header}
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-wider text-smoke">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => <div key={d} className="py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const list = appts.filter((a) => toZoned(a.startsAt, tz).date === d && a.status !== "CANCELLED");
            const off = timeOff.some((t) => t.startsAt <= zonedToUtc(d, 720, tz) && t.endsAt > zonedToUtc(d, 720, tz) && t.kind !== "BLOCK");
            return (
              <Link key={d} href={q({ view: "day", date: d })} className={cn("min-h-20 rounded-lg border p-1.5 text-left transition hover:border-gold/40", d === today ? "border-gold/50 bg-gold/5" : "border-line/60 bg-coal/40")}>
                <span className="text-xs text-mist">{Number(d.slice(8))}</span>
                {list.length > 0 && <span className="mt-1 block rounded bg-gold/15 px-1 text-[11px] text-gold-soft">{list.length} atend.</span>}
                {off && <span className="mt-1 block rounded bg-copper/15 px-1 text-[11px] text-copper">folga</span>}
              </Link>
            );
          })}
        </div>
      </Card>
    );
  }

  if (view === "week") {
    return (
      <Card>
        {header}
        <div className="grid gap-2 md:grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((d) => {
            const list = appts.filter((a) => toZoned(a.startsAt, tz).date === d);
            return (
              <div key={d} className={cn("rounded-xl border p-2", d === today ? "border-gold/50" : "border-line/60")}>
                <Link href={q({ view: "day", date: d })} className="mb-2 block text-xs text-mist hover:text-cream">
                  {WEEKDAY_SHORT[weekdayOf(d)]} <span className="font-display text-lg text-cream">{d.slice(8)}</span>
                </Link>
                <ul className="space-y-1">
                  {list.length === 0 && <li className="text-[11px] text-smoke">—</li>}
                  {list.map((a) => (
                    <li key={a.id} className={cn("rounded-lg border-l-2 bg-coal/60 px-2 py-1 text-[11px]", a.status === "CANCELLED" ? "border-danger/50 opacity-50 line-through" : "border-gold")}>
                      <span className="text-gold-soft">{formatTime(a.startsAt, tz)}</span> {a.client.name.split(" ")[0]}
                      <span className="block truncate text-smoke">{a.service.name}{!barberProfileId && ` · ${a.barber.displayName}`}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Card>
    );
  }

  // Dia: lista + horários livres reais
  let free: string[] = [];
  if (barberProfileId) {
    const min = await prisma.barberService.findFirst({ where: { barberProfileId, active: true }, include: { service: true }, orderBy: { service: { durationMin: "asc" } } });
    if (min) {
      const av = await getAvailability({ shopId: shop.id, barberProfileId, serviceId: min.serviceId, date, ignoreMinAdvance: true });
      free = av.slots.map((s) => formatTime(s.start, tz));
    }
  }
  const dayOff = timeOff.filter((t) => t.startsAt < to && t.endsAt > from);
  return (
    <Card>
      {header}
      {dayOff.map((t) => (
        <div key={t.id} className="mb-2 rounded-xl border border-copper/30 bg-copper/5 px-3 py-2 text-sm text-copper">
          {TIME_OFF_LABEL[t.kind as TimeOffKind]}{!barberProfileId && ` · ${t.barber.displayName}`}: {formatTime(t.startsAt, tz)}–{formatTime(t.endsAt, tz)} {t.reason && `· ${t.reason}`}
        </div>
      ))}
      {appts.length === 0 ? (
        <p className="py-6 text-center text-sm text-smoke">Nenhum atendimento neste dia.</p>
      ) : (
        <ul className="space-y-2">
          {appts.map((a) => (
            <li key={a.id} className={cn("flex flex-col gap-3 rounded-xl border border-line/60 bg-coal/40 p-3 lg:flex-row lg:items-center", a.status === "CANCELLED" && "opacity-60")}>
              <div className="w-28 shrink-0">
                <p className="font-display text-2xl text-gold-soft">{formatTime(a.startsAt, tz)}</p>
                <p className="text-[11px] text-smoke">até {formatTime(a.endsAt, tz)}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-cream">{a.client.name} <span className="text-xs font-normal text-smoke">{role === "ADMIN" && a.client.phone}</span></p>
                <p className="text-xs text-smoke">{a.service.name} · {formatMoney(a.priceCents)}{!barberProfileId && ` · ${a.barber.displayName}`}{a.station && ` · ${a.station.name}`}</p>
                {a.clientNote && <p className="text-xs italic text-smoke">“{a.clientNote}”</p>}
                <Badge tone={STATUS_TONE[a.status]} className="mt-1">{APPOINTMENT_STATUS_LABEL[a.status as AppointmentStatus]}</Badge>
              </div>
              <AppointmentActions a={toActionable(a, { role, policyHours: shop.cancelPolicyHours })} today={today} maxAdvanceDays={shop.maxAdvanceDays} adminMode={role === "ADMIN"} />
            </li>
          ))}
        </ul>
      )}
      {barberProfileId && (
        <div className="mt-5 border-t hairline pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-mist">Horários livres (serviço mais curto)</p>
          {free.length === 0 ? <p className="text-sm text-smoke">Sem horários livres.</p> : (
            <div className="flex flex-wrap gap-1.5">
              {free.map((f) => <span key={f} className="rounded-lg border border-success/30 bg-success/5 px-2 py-1 text-xs tabular-nums text-success">{f}</span>)}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
