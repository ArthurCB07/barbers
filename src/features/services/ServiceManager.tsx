"use client";

import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { Badge, Button, Checkbox, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { ActionButton, Dialog, ImageUpload, SubmitButton, useAction } from "@/components/ui/client";
import { createCategoryAction, toggleServiceAction, upsertServiceAction } from "@/server/actions/app";
import { formatDuration, formatMoney, parseMoneyToCents } from "@/lib/utils";

interface Svc {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  durationMin: number;
  categoryId: string | null;
  imageUrl: string | null;
  active: boolean;
  barberIds: string[];
}

export function ServiceManager({ services, categories, barbers }: { services: Svc[]; categories: Array<{ id: string; name: string }>; barbers: Array<{ id: string; displayName: string }> }) {
  const [editing, setEditing] = useState<Svc | "new" | null>(null);
  const [cat, setCat] = useState("");
  const catAct = useAction(createCategoryAction, { onSuccess: () => setCat("") });
  return (
    <>
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Novo serviço</Button>
        <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (cat.trim()) void catAct.run(cat); }}>
          <Field label="Nova categoria" htmlFor="cat"><Input id="cat" className="h-10 w-48" value={cat} onChange={(e) => setCat(e.target.value)} /></Field>
          <Button type="submit" variant="secondary" disabled={catAct.pending}>Criar</Button>
        </form>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {services.map((s) => (
          <div key={s.id} className={`rounded-2xl border p-4 ${s.active ? "border-line bg-graphite/60" : "border-dashed border-line/60 opacity-60"}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-cream">{s.name}</p>
                <p className="text-xs text-smoke">{categories.find((c) => c.id === s.categoryId)?.name ?? "Sem categoria"} · {formatDuration(s.durationMin)}</p>
              </div>
              <span className="font-display text-xl text-gold-soft">{formatMoney(s.priceCents)}</span>
            </div>
            {s.description && <p className="mt-2 line-clamp-2 text-sm text-mist">{s.description}</p>}
            <p className="mt-2 text-xs text-smoke">{s.barberIds.length} profissional(is) habilitado(s)</p>
            <div className="mt-3 flex items-center gap-2">
              {!s.active && <Badge>Inativo</Badge>}
              <Button size="sm" variant="secondary" onClick={() => setEditing(s)}><Pencil className="h-3.5 w-3.5" /> Editar</Button>
              <ActionButton action={() => toggleServiceAction(s.id, !s.active)} variant="ghost">{s.active ? "Desativar" : "Ativar"}</ActionButton>
            </div>
          </div>
        ))}
      </div>
      {editing && <ServiceForm key={editing === "new" ? "new" : editing.id} svc={editing === "new" ? null : editing} categories={categories} barbers={barbers} onClose={() => setEditing(null)} />}
    </>
  );
}

function ServiceForm({ svc, categories, barbers, onClose }: { svc: Svc | null; categories: Array<{ id: string; name: string }>; barbers: Array<{ id: string; displayName: string }>; onClose: () => void }) {
  const [f, setF] = useState({
    name: svc?.name ?? "",
    description: svc?.description ?? "",
    price: svc ? (svc.priceCents / 100).toFixed(2).replace(".", ",") : "",
    durationMin: String(svc?.durationMin ?? 30),
    categoryId: svc?.categoryId ?? "",
    imageUrl: svc?.imageUrl ?? null,
    active: svc?.active ?? true,
    barberIds: svc?.barberIds ?? barbers.map((b) => b.id),
  });
  const { run, pending, fieldErrors: fe } = useAction((d: unknown) => upsertServiceAction(svc?.id ?? null, d), { onSuccess: onClose });
  return (
    <Dialog open onClose={onClose} title={svc ? "Editar serviço" : "Novo serviço"} wide>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void run({ ...f, priceCents: parseMoneyToCents(f.price), durationMin: Number(f.durationMin), categoryId: f.categoryId || null }); }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" htmlFor="n" error={fe.name}><Input id="n" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Categoria" htmlFor="c"><Select id="c" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}><option value="">Sem categoria</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          <Field label="Preço (R$)" htmlFor="p" error={fe.priceCents}><Input id="p" inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field>
          <Field label="Duração (min)" htmlFor="d" error={fe.durationMin} hint="múltiplos de 5"><Input id="d" inputMode="numeric" value={f.durationMin} onChange={(e) => setF({ ...f, durationMin: e.target.value })} /></Field>
        </div>
        <Field label="Descrição" htmlFor="desc"><Textarea id="desc" value={f.description} maxLength={400} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <ImageUpload value={f.imageUrl} onChange={(v) => setF({ ...f, imageUrl: v })} label="Imagem (opcional)" name={f.name || "Serviço"} />
        <fieldset className="rounded-xl border border-line p-4">
          <legend className="px-1 text-xs uppercase tracking-[0.14em] text-mist">Profissionais habilitados</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {barbers.map((b) => (
              <Checkbox key={b.id} checked={f.barberIds.includes(b.id)} onChange={(e) => setF({ ...f, barberIds: e.target.checked ? [...f.barberIds, b.id] : f.barberIds.filter((x) => x !== b.id) })} label={b.displayName} />
            ))}
          </div>
          <p className="mt-2 text-xs text-smoke">Preços e durações próprios por profissional são definidos em Equipe → profissional.</p>
        </fieldset>
        <Checkbox checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} label="Disponível para agendamento" />
        <SubmitButton pending={pending}>Salvar serviço</SubmitButton>
      </form>
    </Dialog>
  );
}
