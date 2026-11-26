"use client";

/**
 * Agendamento em uma única tela: serviço, dia e horário (consultado no
 * servidor) com resumo fixo no rodapé. Reutilizado no painel 3D, no modo 2D,
 * na remarcação e no lançamento manual do proprietário.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, Clock, Loader2, LogIn, ArrowRight, CalendarX } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/primitives";
import { useAction } from "@/components/ui/client";
import { createAppointmentAction, rescheduleAppointmentAction } from "@/server/actions/app";
import { addDays, formatLongDate, weekdayOf, WEEKDAY_SHORT } from "@/lib/time";
import { cn, formatDuration, formatMoney } from "@/lib/utils";
import type { BarberServiceOption } from "@/features/barbershop-3d/types";

interface Slot {
  startMin: number;
  label: string;
}

export interface BookingFlowProps {
  barber: { id: string; displayName: string };
  services: BarberServiceOption[];
  today: string;
  maxAdvanceDays: number;
  isLoggedIn: boolean;
  canBook: boolean;
  cannotBookReason?: string;
  loginHref: string;
  mode?: "book" | "reschedule";
  appointmentId?: string;
  fixedServiceId?: string;
  initialServiceId?: string;
  clientUserId?: string;
  adminMode?: boolean;
  onDone?: () => void;
  /** Conteúdo no topo da área rolável (apresentação do profissional) */
  intro?: React.ReactNode;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function BookingFlow(props: BookingFlowProps) {
  const { barber, services, today, maxAdvanceDays, mode = "book" } = props;
  const [serviceId, setServiceId] = useState<string | null>(props.fixedServiceId ?? props.initialServiceId ?? (services.length === 1 ? services[0].id : null));
  const [date, setDate] = useState<string>(today);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [note, setNote] = useState("");
  const [done, setDone] = useState<null | { date: string; label: string }>(null);
  const [stripStart, setStripStart] = useState(0);
  const whenRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const service = services.find((s) => s.id === serviceId) ?? null;
  const days = useMemo(() => Array.from({ length: Math.min(maxAdvanceDays + 1, 62) }, (_, i) => addDays(today, i)), [today, maxAdvanceDays]);
  const visibleDays = days.slice(stripStart, stripStart + 7);

  const book = useAction(createAppointmentAction, { onSuccess: () => slot && setDone({ date, label: slot.label }) });
  const resched = useAction((input: { date: string; startMin: number }) => rescheduleAppointmentAction(props.appointmentId!, input), {
    onSuccess: () => {
      if (slot) setDone({ date, label: slot.label });
      props.onDone?.();
    },
  });
  const pending = book.pending || resched.pending;

  useEffect(() => {
    setSlot(null);
    if (!serviceId) return;
    let alive = true;
    setLoadingSlots(true);
    const qs = new URLSearchParams({ barberId: barber.id, serviceId, date });
    if (props.appointmentId) qs.set("exclude", props.appointmentId);
    if (props.adminMode) qs.set("admin", "1");
    fetch(`/api/availability?${qs}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        setSlots(j.error ? [] : j.slots);
        setReason(j.error ?? j.reason);
      })
      .catch(() => {
        if (alive) {
          setSlots([]);
          setReason("Não foi possível consultar os horários. Tente novamente.");
        }
      })
      .finally(() => alive && setLoadingSlots(false));
    return () => {
      alive = false;
    };
  }, [serviceId, date, barber.id, props.appointmentId, props.adminMode]);

  function pickService(id: string) {
    setServiceId(id);
    // Rola apenas a área interna do painel (nunca a página inteira)
    requestAnimationFrame(() => {
      const box = scrollRef.current;
      const target = whenRef.current;
      if (!box || !target || box.scrollHeight <= box.clientHeight) return;
      box.scrollTo({ top: target.offsetTop - 12, behavior: "smooth" });
    });
  }

  function pickDate(d: string) {
    setDate(d);
    const idx = days.indexOf(d);
    if (idx >= 0 && (idx < stripStart || idx >= stripStart + 7)) setStripStart(Math.floor(idx / 7) * 7);
  }

  if (done) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <div className="animate-fade-up">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success ring-8 ring-success/5">
            <Check className="h-7 w-7" />
          </div>
          <p className="font-display text-3xl text-cream">{mode === "reschedule" ? "Horário alterado" : "Está marcado!"}</p>
          <p className="mt-2 text-sm text-mist">
            {service?.name} com {barber.displayName}
          </p>
          <p className="mt-1 text-lg font-medium text-gold-soft">
            {cap(formatLongDate(done.date))} · {done.label}
          </p>
          <p className="mt-3 text-xs text-smoke">Você receberá a confirmação nas suas notificações.</p>
          {!props.adminMode && mode === "book" && (
            <Link href="/cliente/agendamentos" className={buttonClass("outline", "md", "mt-6")}>
              Ver meus agendamentos <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    );
  }

  const sectionTitle = "mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-smoke";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="relative min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-5">
        {props.intro}
        {/* Serviço */}
        {!props.fixedServiceId && (
          <section aria-labelledby="bk-service">
            <h3 id="bk-service" className={sectionTitle}>Serviço</h3>
            {services.length === 0 ? (
              <p className="text-sm text-smoke">Este profissional ainda não tem serviços disponíveis.</p>
            ) : (
              <div role="radiogroup" aria-labelledby="bk-service" className="space-y-1.5">
                {services.map((s) => {
                  const on = serviceId === s.id;
                  return (
                    <button
                      key={s.id}
                      role="radio"
                      aria-checked={on}
                      onClick={() => pickService(s.id)}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition",
                        on ? "border-gold/60 bg-gold/[0.08] shadow-[inset_0_0_0_1px_rgba(200,161,101,0.25)]" : "border-white/[0.06] bg-white/[0.02] hover:border-gold/25 hover:bg-white/[0.04]",
                      )}
                    >
                      <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition", on ? "border-gold bg-gold text-ink" : "border-line")}>
                        {on && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-cream">{s.name}</span>
                        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-smoke">
                          <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap">
                            <Clock className="h-3 w-3" /> {formatDuration(s.durationMin)}
                          </span>
                          {s.description && <span className="min-w-0 truncate">· {s.description}</span>}
                        </span>
                      </span>
                      <span className="shrink-0 font-display text-lg text-gold-soft">{formatMoney(s.priceCents)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Dia e horário */}
        {serviceId && (
          <section ref={whenRef} aria-labelledby="bk-when" className="animate-fade-up">
            <div className="mb-3 flex items-center justify-between">
              <h3 id="bk-when" className={cn(sectionTitle, "mb-0")}>Dia e horário</h3>
              <div className="flex items-center gap-0.5">
                <button className="rounded-full p-1.5 text-mist hover:bg-white/5 disabled:opacity-30" aria-label="Semana anterior" disabled={stripStart === 0} onClick={() => setStripStart((v) => Math.max(0, v - 7))}>
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button className="rounded-full p-1.5 text-mist hover:bg-white/5 disabled:opacity-30" aria-label="Próxima semana" disabled={stripStart + 7 >= days.length} onClick={() => setStripStart((v) => v + 7)}>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {visibleDays.map((d) => {
                const on = date === d;
                return (
                  <button
                    key={d}
                    onClick={() => pickDate(d)}
                    aria-pressed={on}
                    aria-label={formatLongDate(d)}
                    className={cn("flex flex-col items-center rounded-2xl py-2 transition", on ? "bg-gradient-to-b from-gold-soft to-gold text-ink shadow-[0_8px_24px_-10px_rgba(200,161,101,0.8)]" : "bg-white/[0.03] text-mist hover:bg-white/[0.07]")}
                  >
                    <span className={cn("text-[10px] font-medium uppercase", on ? "text-ink/70" : "text-smoke")}>{d === today ? "Hoje" : WEEKDAY_SHORT[weekdayOf(d)]}</span>
                    <span className="font-display text-xl font-semibold leading-tight">{Number(d.slice(8))}</span>
                    <span className={cn("text-[10px]", on ? "text-ink/70" : "text-smoke")}>{MONTHS[Number(d.slice(5, 7)) - 1]}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4" aria-busy={loadingSlots} aria-live="polite">
              {loadingSlots || slots === null ? (
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 8 }, (_, i) => (
                    <div key={i} className="skeleton h-10 rounded-xl" />
                  ))}
                </div>
              ) : slots.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-2xl bg-white/[0.02] px-4 py-6 text-center">
                  <CalendarX className="h-6 w-6 text-smoke" />
                  <p className="text-sm text-mist">{reason ?? "Sem horários livres nesta data."}</p>
                  {addDays(date, 1) <= days[days.length - 1] && (
                    <button className="text-xs font-medium text-gold-soft hover:text-gold" onClick={() => pickDate(addDays(date, 1))}>
                      Ver o dia seguinte →
                    </button>
                  )}
                </div>
              ) : (
                <div role="radiogroup" aria-label="Horários disponíveis" className="grid grid-cols-4 gap-2">
                  {slots.map((s) => {
                    const on = slot?.startMin === s.startMin;
                    return (
                      <button
                        key={s.startMin}
                        role="radio"
                        aria-checked={on}
                        onClick={() => setSlot(s)}
                        className={cn("h-10 rounded-xl text-sm font-medium tabular-nums transition", on ? "bg-cream text-ink" : "bg-white/[0.04] text-cream hover:bg-white/[0.09]")}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {serviceId && slot && mode === "book" && props.canBook && props.isLoggedIn && (
          <section className="animate-fade-up">
            <label htmlFor="bk-note" className={sectionTitle + " block"}>Observação (opcional)</label>
            <textarea
              id="bk-note"
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: degradê baixo, manter o comprimento em cima"
              className="min-h-16 w-full rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-cream placeholder:text-smoke/70 focus:border-gold/50 focus:outline-none"
            />
          </section>
        )}
      </div>

      {/* Resumo fixo */}
      <div className="shrink-0 border-t border-white/[0.06] bg-black/30 px-5 py-4 backdrop-blur">
        {service ? (
          <div className="mb-3 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-cream">{service.name}</p>
              <p className="truncate text-xs text-smoke">{slot ? `${cap(formatLongDate(date))} · ${slot.label}` : "Escolha um horário"} · {formatDuration(service.durationMin)}</p>
            </div>
            <p className="shrink-0 font-display text-2xl text-gold-soft">{formatMoney(service.priceCents)}</p>
          </div>
        ) : (
          <p className="mb-3 text-sm text-smoke">Escolha um serviço para ver os horários.</p>
        )}
        {!props.isLoggedIn ? (
          <Link href={props.loginHref} className={buttonClass("primary", "lg", "w-full")}>
            <LogIn className="h-4 w-4" /> Entrar para agendar
          </Link>
        ) : !props.canBook ? (
          <p className="rounded-xl bg-warning/10 px-3 py-2.5 text-center text-sm text-warning">{props.cannotBookReason ?? "Não é possível agendar com esta conta."}</p>
        ) : (
          <Button
            size="lg"
            className="w-full"
            disabled={!service || !slot || pending}
            onClick={() =>
              service && slot &&
              (mode === "reschedule"
                ? resched.run({ date, startMin: slot.startMin })
                : book.run({ barberProfileId: barber.id, serviceId: service.id, date, startMin: slot.startMin, clientNote: note, clientUserId: props.clientUserId }))
            }
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "reschedule" ? "Confirmar novo horário" : "Confirmar agendamento"}
          </Button>
        )}
        <p className="mt-2 text-center text-[11px] text-smoke">Pagamento na barbearia · dinheiro, Pix ou cartão</p>
      </div>
    </div>
  );
}
