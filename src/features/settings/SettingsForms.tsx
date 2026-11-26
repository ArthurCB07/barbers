"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Card, CardTitle, Checkbox, Field, Input, Select, Textarea, Button } from "@/components/ui/primitives";
import { ActionButton, ImageUpload, SubmitButton, toast, useAction } from "@/components/ui/client";
import { addHolidayAction, removeHolidayAction, updateShopHoursAction, updateShopSettingsAction } from "@/server/actions/app";
import { WEEKDAY_LABELS, hhmmToMinutes, minutesToHHMM } from "@/lib/time";

type Shop = {
  name: string; tagline: string; description: string; address: string; city: string; phone: string; whatsapp: string; instagram: string; accentColor: string; logoUrl: string | null;
  slotStepMinutes: number; bufferMinutes: number; minAdvanceMinutes: number; maxAdvanceDays: number; cancelPolicyHours: number; autoConfirm: boolean; cancellationPolicyText: string; barberCanBlockAgenda: boolean; barberCanEditPrices: boolean;
};

export function ShopSettingsForm({ shop }: { shop: Shop }) {
  const [f, setF] = useState(shop);
  const set = <K extends keyof Shop>(k: K, v: Shop[K]) => setF((p) => ({ ...p, [k]: v }));
  const { run, pending, fieldErrors: fe } = useAction(updateShopSettingsAction);
  const text = (k: keyof Shop, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Field label={label} htmlFor={k} error={fe[k]}>
      <Input id={k} value={String(f[k] ?? "")} onChange={(e) => set(k, e.target.value as never)} {...props} />
    </Field>
  );
  return (
    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); void run(f); }}>
      <Card>
        <CardTitle>Identidade da barbearia</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          {text("name", "Nome comercial")}
          {text("tagline", "Slogan")}
          {text("address", "Endereço")}
          {text("city", "Cidade / UF")}
          {text("phone", "Telefone")}
          {text("whatsapp", "WhatsApp")}
          {text("instagram", "Instagram / redes")}
          <Field label="Cor de destaque" htmlFor="accent"><Input id="accent" type="color" className="h-11 p-1" value={f.accentColor} onChange={(e) => set("accentColor", e.target.value)} /></Field>
        </div>
        <Field label="Descrição" htmlFor="desc" className="mt-4"><Textarea id="desc" value={f.description} maxLength={800} onChange={(e) => set("description", e.target.value)} /></Field>
        <div className="mt-4"><ImageUpload value={f.logoUrl} onChange={(v) => set("logoUrl", v)} label="Logotipo" name={f.name} /></div>
      </Card>
      <Card>
        <CardTitle>Regras de agendamento</CardTitle>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Intervalo entre horários" htmlFor="step"><Select id="step" value={f.slotStepMinutes} onChange={(e) => set("slotStepMinutes", Number(e.target.value))}>{[5, 10, 15, 20, 30, 60].map((v) => <option key={v} value={v}>{v} min</option>)}</Select></Field>
          <Field label="Pausa entre atendimentos (min)" htmlFor="buf" error={fe.bufferMinutes}><Input id="buf" type="number" min={0} step={5} value={f.bufferMinutes} onChange={(e) => set("bufferMinutes", Number(e.target.value))} /></Field>
          <Field label="Antecedência mínima (min)" htmlFor="min"><Input id="min" type="number" min={0} value={f.minAdvanceMinutes} onChange={(e) => set("minAdvanceMinutes", Number(e.target.value))} /></Field>
          <Field label="Agendar até (dias à frente)" htmlFor="max"><Input id="max" type="number" min={1} value={f.maxAdvanceDays} onChange={(e) => set("maxAdvanceDays", Number(e.target.value))} /></Field>
          <Field label="Cancelar/remarcar até (h antes)" htmlFor="pol"><Input id="pol" type="number" min={0} value={f.cancelPolicyHours} onChange={(e) => set("cancelPolicyHours", Number(e.target.value))} /></Field>
        </div>
        <Field label="Texto da política de cancelamento" htmlFor="poltxt" className="mt-4"><Textarea id="poltxt" value={f.cancellationPolicyText} onChange={(e) => set("cancellationPolicyText", e.target.value)} /></Field>
        <div className="mt-4 space-y-2">
          <Checkbox checked={f.autoConfirm} onChange={(e) => set("autoConfirm", e.target.checked)} label="Confirmar agendamentos automaticamente" description="Desmarcado: novas reservas ficam pendentes até confirmação." />
          <Checkbox checked={f.barberCanBlockAgenda} onChange={(e) => set("barberCanBlockAgenda", e.target.checked)} label="Barbeiros podem bloquear horários sem aprovação" />
          <Checkbox checked={f.barberCanEditPrices} onChange={(e) => set("barberCanEditPrices", e.target.checked)} label="Barbeiros podem editar os próprios preços e durações" />
        </div>
      </Card>
      <SubmitButton pending={pending} size="lg">Salvar configurações</SubmitButton>
    </form>
  );
}

export function ShopHoursForm({ hours }: { hours: Array<{ weekday: number; openMin: number; closeMin: number; closed: boolean }> }) {
  const [days, setDays] = useState(Array.from({ length: 7 }, (_, w) => { const h = hours.find((x) => x.weekday === w); return { weekday: w, closed: h?.closed ?? true, open: minutesToHHMM(h?.openMin ?? 540), close: minutesToHHMM(h?.closeMin ?? 1200) }; }));
  const { run, pending } = useAction(updateShopHoursAction);
  return (
    <Card>
      <CardTitle action={<Button size="sm" disabled={pending} onClick={() => { try { void run(days.map((d) => ({ weekday: d.weekday, closed: d.closed, openMin: hhmmToMinutes(d.open), closeMin: hhmmToMinutes(d.close) }))); } catch (e) { toast(String(e), "error"); } }}>Salvar</Button>}>Horário de funcionamento</CardTitle>
      <div className="space-y-2">
        {days.map((d, i) => (
          <div key={d.weekday} className="flex min-h-9 items-center gap-2 text-sm">
            <Checkbox className="w-24 shrink-0 items-center" checked={!d.closed} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, closed: !e.target.checked } : x)))} label={WEEKDAY_LABELS[d.weekday]} />
            {d.closed ? (
              <span className="text-smoke">Fechado</span>
            ) : (
              <div className="flex min-w-0 items-center gap-1.5">
                <Input type="time" className="h-9 w-[104px] px-2" aria-label={`Abertura ${WEEKDAY_LABELS[d.weekday]}`} value={d.open} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, open: e.target.value } : x)))} />
                <span className="text-smoke">–</span>
                <Input type="time" className="h-9 w-[104px] px-2" aria-label={`Fechamento ${WEEKDAY_LABELS[d.weekday]}`} value={d.close} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, close: e.target.value } : x)))} />
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function HolidaysForm({ holidays }: { holidays: Array<{ id: string; date: string; name: string }> }) {
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const { run, pending } = useAction(addHolidayAction, { onSuccess: () => { setDate(""); setName(""); } });
  return (
    <Card>
      <CardTitle>Feriados e fechamentos</CardTitle>
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); void run(date, name); }}>
        <Input type="date" className="h-10 w-40" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Data" required />
        <Input className="h-10 flex-1" placeholder="Nome (ex.: Natal)" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nome do feriado" required />
        <Button type="submit" disabled={pending}>Adicionar</Button>
      </form>
      <ul className="mt-4 space-y-1">
        {holidays.length === 0 && <li className="text-sm text-smoke">Nenhum feriado cadastrado.</li>}
        {holidays.map((h) => (
          <li key={h.id} className="flex items-center justify-between rounded-lg border border-line/60 px-3 py-1.5 text-sm">
            <span className="text-mist">{h.date.split("-").reverse().join("/")} · {h.name}</span>
            <ActionButton action={() => removeHolidayAction(h.id)} variant="ghost"><Trash2 className="h-3.5 w-3.5" /></ActionButton>
          </li>
        ))}
      </ul>
    </Card>
  );
}
