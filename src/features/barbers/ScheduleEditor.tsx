"use client";

/** Editor de jornada semanal + folgas/férias/bloqueios (barbeiro e proprietário) */
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Badge, Button, Card, CardTitle, Checkbox, Field, Input, Select } from "@/components/ui/primitives";
import { ActionButton, useAction, toast } from "@/components/ui/client";
import { createTimeOffAction, deleteTimeOffAction, updateWorkingHoursAction, reviewTimeOffAction } from "@/server/actions/app";
import { WEEKDAY_LABELS, minutesToHHMM, hhmmToMinutes } from "@/lib/time";
import { TIME_OFF_LABEL, TIME_OFF_KINDS } from "@/types/domain";

interface Day {
  weekday: number;
  enabled: boolean;
  start: string;
  end: string;
  hasBreak: boolean;
  breakStart: string;
  breakEnd: string;
}

export function WorkingHoursEditor({ barberProfileId, hours }: { barberProfileId: string; hours: Array<{ weekday: number; startMin: number; endMin: number; breakStartMin: number | null; breakEndMin: number | null }> }) {
  const [days, setDays] = useState<Day[]>(
    Array.from({ length: 7 }, (_, w) => {
      const h = hours.find((x) => x.weekday === w);
      return {
        weekday: w,
        enabled: !!h,
        start: minutesToHHMM(h?.startMin ?? 540),
        end: minutesToHHMM(h?.endMin ?? 1140),
        hasBreak: h ? h.breakStartMin != null : true,
        breakStart: minutesToHHMM(h?.breakStartMin ?? 720),
        breakEnd: minutesToHHMM(h?.breakEndMin ?? 780),
      };
    }),
  );
  const { run, pending } = useAction((d: unknown) => updateWorkingHoursAction(barberProfileId, d));
  const upd = (i: number, patch: Partial<Day>) => setDays((p) => p.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  function save() {
    try {
      const payload = days.map((d) => ({
        weekday: d.weekday,
        enabled: d.enabled,
        startMin: hhmmToMinutes(d.start),
        endMin: hhmmToMinutes(d.end),
        breakStartMin: d.hasBreak ? hhmmToMinutes(d.breakStart) : null,
        breakEndMin: d.hasBreak ? hhmmToMinutes(d.breakEnd) : null,
      }));
      void run(payload);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Horário inválido", "error");
    }
  }
  return (
    <Card>
      <CardTitle action={<Button size="sm" onClick={save} disabled={pending}>Salvar jornada</Button>}>Jornada semanal</CardTitle>
      <div className="space-y-2">
        {days.map((d, i) => (
          <div key={d.weekday} className="grid grid-cols-1 items-center gap-3 rounded-xl border border-line/60 bg-coal/40 p-3 sm:grid-cols-[130px_1fr]">
            <Checkbox checked={d.enabled} onChange={(e) => upd(i, { enabled: e.target.checked })} label={WEEKDAY_LABELS[d.weekday]} />
            {d.enabled ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Input type="time" aria-label={`Início ${WEEKDAY_LABELS[d.weekday]}`} className="h-9 w-28" value={d.start} onChange={(e) => upd(i, { start: e.target.value })} />
                  <span className="w-4 text-center text-smoke">às</span>
                  <Input type="time" aria-label={`Fim ${WEEKDAY_LABELS[d.weekday]}`} className="h-9 w-28" value={d.end} onChange={(e) => upd(i, { end: e.target.value })} />
                </div>
                <label className="flex items-center gap-1.5 text-xs text-mist">
                  <input type="checkbox" checked={d.hasBreak} onChange={(e) => upd(i, { hasBreak: e.target.checked })} className="accent-[#c8a165]" /> Intervalo
                </label>
                {d.hasBreak && (
                  <div className="flex items-center gap-2">
                    <Input type="time" aria-label="Início do intervalo" className="h-9 w-28" value={d.breakStart} onChange={(e) => upd(i, { breakStart: e.target.value })} />
                    <span className="w-4 text-center text-smoke">–</span>
                    <Input type="time" aria-label="Fim do intervalo" className="h-9 w-28" value={d.breakEnd} onChange={(e) => upd(i, { breakEnd: e.target.value })} />
                  </div>
                )}
              </div>
            ) : (
              <span className="text-sm text-smoke">Folga semanal</span>
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-smoke">A disponibilidade final também respeita o horário de funcionamento da barbearia, feriados e a antecedência mínima.</p>
    </Card>
  );
}

export function TimeOffManager({ barberProfileId, items, today, isAdmin, canBlock }: { barberProfileId: string; items: Array<{ id: string; kind: string; label: string; status: string; reason: string }>; today: string; isAdmin: boolean; canBlock: boolean }) {
  const [f, setF] = useState({ kind: "BLOCK", startDate: today, endDate: today, partial: true, start: "12:00", end: "14:00", reason: "" });
  const { run, pending } = useAction(createTimeOffAction, {
    onSuccess: (d) => {
      const r = d as { status: string; conflicts: Array<{ when: string; client: string }> } | undefined;
      toast(r?.status === "PENDING" ? "Pedido enviado ao proprietário para aprovação." : "Período registrado na agenda.");
      if (r?.conflicts.length) toast(`Atenção: ${r.conflicts.length} atendimento(s) já marcados neste período (${r.conflicts.map((c) => c.when).join(", ")}). Remarque-os ou cancele-os.`, "error");
    },
  });
  return (
    <Card>
      <CardTitle>Folgas, férias e bloqueios</CardTitle>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const partial = f.kind === "BLOCK" && f.partial;
          void run({ barberProfileId, kind: f.kind, startDate: f.startDate, endDate: partial ? f.startDate : f.endDate, startMin: partial ? hhmmToMinutes(f.start) : null, endMin: partial ? hhmmToMinutes(f.end) : null, reason: f.reason });
        }}
      >
        <Field label="Tipo" htmlFor="kind">
          <Select id="kind" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
            {TIME_OFF_KINDS.map((k) => (
              <option key={k} value={k}>{TIME_OFF_LABEL[k]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Motivo (opcional)" htmlFor="reason">
          <Input id="reason" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} maxLength={200} />
        </Field>
        <Field label={f.kind === "BLOCK" && f.partial ? "Data" : "De"} htmlFor="sd">
          <Input id="sd" type="date" min={today} value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} />
        </Field>
        {f.kind === "BLOCK" && f.partial ? (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Das" htmlFor="st"><Input id="st" type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
            <Field label="Às" htmlFor="et"><Input id="et" type="time" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></Field>
          </div>
        ) : (
          <Field label="Até" htmlFor="ed">
            <Input id="ed" type="date" min={f.startDate} value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} />
          </Field>
        )}
        {f.kind === "BLOCK" && <Checkbox className="sm:col-span-2" checked={f.partial} onChange={(e) => setF({ ...f, partial: e.target.checked })} label="Bloquear apenas um intervalo de horas" />}
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending}>{isAdmin || (f.kind === "BLOCK" && canBlock) ? "Registrar" : "Solicitar aprovação"}</Button>
          {!isAdmin && <p className="mt-2 text-xs text-smoke">{canBlock ? "Bloqueios entram na hora; folgas e férias passam pela aprovação do proprietário." : "Todos os pedidos passam pela aprovação do proprietário."}</p>}
        </div>
      </form>
      <ul className="mt-5 space-y-2">
        {items.length === 0 && <li className="text-sm text-smoke">Nenhum período futuro registrado.</li>}
        {items.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line/60 bg-coal/40 px-3 py-2 text-sm">
            <Badge tone={t.status === "APPROVED" ? "success" : t.status === "PENDING" ? "warning" : "danger"}>{t.status === "APPROVED" ? "Aprovado" : t.status === "PENDING" ? "Pendente" : "Recusado"}</Badge>
            <span className="text-cream">{TIME_OFF_LABEL[t.kind as keyof typeof TIME_OFF_LABEL]}</span>
            <span className="text-mist">{t.label}</span>
            {t.reason && <span className="text-xs text-smoke">· {t.reason}</span>}
            <span className="ml-auto flex gap-1">
              {isAdmin && t.status === "PENDING" && (
                <>
                  <ActionButton action={() => reviewTimeOffAction(t.id, true)} variant="outline">Aprovar</ActionButton>
                  <ActionButton action={() => reviewTimeOffAction(t.id, false)} variant="ghost">Recusar</ActionButton>
                </>
              )}
              {(isAdmin || t.kind === "BLOCK" || t.status === "PENDING") && (
                <ActionButton action={() => deleteTimeOffAction(t.id)} variant="ghost" confirm="Remover este período?">
                  <Trash2 className="h-3.5 w-3.5" />
                </ActionButton>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
