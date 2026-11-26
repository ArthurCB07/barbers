"use client";

/** Edição do perfil público e dos serviços/preços de um profissional */
import { useState } from "react";
import { Card, CardTitle, Field, Input, Textarea, Button, Checkbox } from "@/components/ui/primitives";
import { ImageUpload, TagInput, SubmitButton, useAction } from "@/components/ui/client";
import { updateBarberProfileAction, updateBarberServicesAction } from "@/server/actions/app";
import { formatMoney, parseMoneyToCents } from "@/lib/utils";

export function BarberProfileEditor({ barberProfileId, initial }: { barberProfileId: string; initial: { displayName: string; bio: string; specialties: string[]; experience: string; photoUrl: string | null } }) {
  const [f, setF] = useState(initial);
  const { run, pending, fieldErrors: fe } = useAction((d: unknown) => updateBarberProfileAction(barberProfileId, d));
  return (
    <Card>
      <CardTitle>Perfil público</CardTitle>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void run(f); }}>
        <ImageUpload value={f.photoUrl} onChange={(v) => setF({ ...f, photoUrl: v })} name={f.displayName} />
        <Field label="Nome profissional" htmlFor="dn" error={fe.displayName}>
          <Input id="dn" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} />
        </Field>
        <Field label="Biografia" htmlFor="bio" error={fe.bio}>
          <Textarea id="bio" value={f.bio} maxLength={800} onChange={(e) => setF({ ...f, bio: e.target.value })} />
        </Field>
        <Field label="Especialidades" htmlFor="sp" error={fe.specialties}>
          <TagInput id="sp" value={f.specialties} onChange={(v) => setF({ ...f, specialties: v })} />
        </Field>
        <Field label="Experiência" htmlFor="exp">
          <Textarea id="exp" className="min-h-16" value={f.experience} maxLength={800} onChange={(e) => setF({ ...f, experience: e.target.value })} />
        </Field>
        <SubmitButton pending={pending}>Salvar perfil</SubmitButton>
      </form>
    </Card>
  );
}

interface Row {
  serviceId: string;
  name: string;
  basePrice: number;
  baseDuration: number;
  enabled: boolean;
  price: string;
  duration: string;
  commission: string;
}

export function BarberServicesEditor({ barberProfileId, services, canEdit, showCommission }: { barberProfileId: string; services: Array<{ serviceId: string; name: string; basePrice: number; baseDuration: number; enabled: boolean; priceCents: number | null; durationMin: number | null; commissionPercent: number | null }>; canEdit: boolean; showCommission: boolean }) {
  const [rows, setRows] = useState<Row[]>(
    services.map((s) => ({
      serviceId: s.serviceId,
      name: s.name,
      basePrice: s.basePrice,
      baseDuration: s.baseDuration,
      enabled: s.enabled,
      price: s.priceCents != null ? (s.priceCents / 100).toFixed(2).replace(".", ",") : "",
      duration: s.durationMin != null ? String(s.durationMin) : "",
      commission: s.commissionPercent != null ? String(s.commissionPercent) : "",
    })),
  );
  const { run, pending } = useAction((d: unknown) => updateBarberServicesAction(barberProfileId, d));
  const upd = (i: number, p: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <Card>
      <CardTitle action={canEdit ? <Button size="sm" disabled={pending} onClick={() => run(rows.map((r) => ({ serviceId: r.serviceId, enabled: r.enabled, priceCents: r.price ? parseMoneyToCents(r.price) : null, durationMin: r.duration ? Number(r.duration) : null, commissionPercent: r.commission ? Number(r.commission) : null })))}>Salvar serviços</Button> : undefined}>
        Serviços oferecidos
      </CardTitle>
      {!canEdit && <p className="mb-3 text-xs text-smoke">Preços e durações são definidos pelo proprietário.</p>}
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={r.serviceId} className="grid grid-cols-3 gap-2 rounded-xl border border-line/60 bg-coal/40 p-3">
            <Checkbox className="col-span-3" disabled={!canEdit} checked={r.enabled} onChange={(e) => upd(i, { enabled: e.target.checked })} label={r.name} description={`Padrão: ${formatMoney(r.basePrice)} · ${r.baseDuration} min`} />
            <Input aria-label={`Preço próprio de ${r.name}`} disabled={!canEdit} placeholder="Preço padrão" inputMode="decimal" className="h-9" value={r.price} onChange={(e) => upd(i, { price: e.target.value })} />
            <Input aria-label={`Duração própria de ${r.name}`} disabled={!canEdit} placeholder="min" inputMode="numeric" className="h-9" value={r.duration} onChange={(e) => upd(i, { duration: e.target.value })} />
            {showCommission ? (
              <Input aria-label={`Comissão de ${r.name} (%)`} disabled={!canEdit} placeholder="% padrão" inputMode="numeric" className="h-9" value={r.commission} onChange={(e) => upd(i, { commission: e.target.value })} />
            ) : <span />}
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-smoke">Deixe em branco para usar o preço/duração padrão do serviço.{showCommission && " O % por serviço vale para o modelo “Comissão por serviço”."}</p>
    </Card>
  );
}
