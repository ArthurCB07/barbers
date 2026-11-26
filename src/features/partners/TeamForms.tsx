"use client";

/** Formulários de Equipe e Parceiros (proprietário) */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Link2 } from "lucide-react";
import { Button, Card, CardTitle, Checkbox, Field, Input, Notice, Select, Textarea } from "@/components/ui/primitives";
import { ActionButton, Dialog, ImageUpload, SubmitButton, TagInput, toast, useAction } from "@/components/ui/client";
import {
  approvePartnerAction, inviteBarberAction, offboardBarberAction, reactivateBarberAction, regenerateInviteAction,
  rejectPartnerAction, requestInfoAction, setAdminRoleAction, updateCommissionAction,
} from "@/server/actions/app";
import { COMMISSION_MODELS, COMMISSION_MODEL_LABEL } from "@/types/domain";
import { WEEKDAY_LABELS, hhmmToMinutes } from "@/lib/time";
import { formatMoney, parseMoneyToCents } from "@/lib/utils";

type Station = { id: string; name: string; occupiedBy: string | null };
type ServiceOpt = { id: string; name: string; priceCents: number; durationMin: number };

function CommissionFields({ v, set }: { v: { commissionModel: string; commissionPercent: string; fixedFee: string; partnershipType: string }; set: (p: Partial<typeof v>) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Modelo de remuneração" htmlFor="cm">
        <Select id="cm" value={v.commissionModel} onChange={(e) => set({ commissionModel: e.target.value })}>
          {COMMISSION_MODELS.map((m) => <option key={m} value={m}>{COMMISSION_MODEL_LABEL[m]}</option>)}
        </Select>
      </Field>
      <Field label="Tipo de parceria" htmlFor="pt">
        <Input id="pt" value={v.partnershipType} onChange={(e) => set({ partnershipType: e.target.value })} placeholder="Ex.: Comissionado, Aluguel de cadeira" />
      </Field>
      {v.commissionModel !== "FIXED" ? (
        <Field label={v.commissionModel === "PER_SERVICE" ? "% padrão do profissional" : "Comissão do profissional (%)"} htmlFor="cp">
          <Input id="cp" inputMode="numeric" value={v.commissionPercent} onChange={(e) => set({ commissionPercent: e.target.value })} />
        </Field>
      ) : (
        <Field label="Valor fixo acordado (R$)" htmlFor="ff" hint="ex.: aluguel mensal da cadeira">
          <Input id="ff" inputMode="decimal" value={v.fixedFee} onChange={(e) => set({ fixedFee: e.target.value })} />
        </Field>
      )}
      <p className="self-end text-xs text-smoke sm:col-span-2">
        {v.commissionModel === "PERCENT" && `Ex.: serviço de R$ 50,00 → profissional recebe ${formatMoney(Math.round(5000 * (Number(v.commissionPercent) || 0) / 100))}.`}
        {v.commissionModel === "PER_SERVICE" && "Defina percentuais específicos por serviço na página do profissional; sem percentual próprio vale o padrão."}
        {v.commissionModel === "FIXED" && "O valor dos serviços fica com o profissional; a obrigação fixa é registrada separadamente."}
      </p>
    </div>
  );
}

// ─── + Adicionar Barbeiro ────────────────────────────────────────────────────

export function InviteBarberForm({ services, stations }: { services: ServiceOpt[]; stations: Station[] }) {
  const router = useRouter();
  const [link, setLink] = useState<string | null>(null);
  const [f, setF] = useState({ name: "", email: "", phone: "", displayName: "", photoUrl: null as string | null, bio: "", specialties: [] as string[], stationId: "" });
  const [comm, setComm] = useState({ commissionModel: "PERCENT", commissionPercent: "50", fixedFee: "0", partnershipType: "Comissionado" });
  const [svc, setSvc] = useState(services.map((s) => ({ id: s.id, enabled: true, price: "", duration: "" })));
  const [days, setDays] = useState(Array.from({ length: 7 }, (_, w) => ({ weekday: w, enabled: w >= 1 && w <= 6, start: "09:00", end: w === 6 ? "18:00" : "19:00", bs: "12:00", be: "13:00" })));
  const { run, pending, fieldErrors: fe } = useAction(inviteBarberAction, { refresh: false, onSuccess: (d) => d && setLink(`${window.location.origin}${d.link}`) });

  if (link) {
    return (
      <Card className="border-success/30">
        <CardTitle>Profissional cadastrado</CardTitle>
        <p className="text-sm text-mist">Envie o link abaixo para o profissional concluir o cadastro (válido por 7 dias, uso único). Ele aparecerá na barbearia 3D assim que aceitar.</p>
        <div className="mt-4 flex gap-2">
          <Input readOnly value={link} aria-label="Link de convite" onFocus={(e) => e.target.select()} />
          <Button onClick={() => { void navigator.clipboard.writeText(link); toast("Link copiado."); }}><Copy className="h-4 w-4" /> Copiar</Button>
        </div>
        <p className="mt-3 text-xs text-smoke">Sem provedor de e-mail configurado, o envio do link é feito por você (WhatsApp, e-mail pessoal etc.).</p>
        <Button variant="outline" className="mt-5" onClick={() => router.push("/admin/equipe")}>Voltar à equipe</Button>
      </Card>
    );
  }

  function submit() {
    try {
      void run({
        ...f,
        stationId: f.stationId || null,
        commissionModel: comm.commissionModel,
        commissionPercent: Number(comm.commissionPercent) || 0,
        fixedFeeCents: parseMoneyToCents(comm.fixedFee) || 0,
        partnershipType: comm.partnershipType,
        services: svc.filter((s) => s.enabled).map((s) => ({ serviceId: s.id, priceCents: s.price ? parseMoneyToCents(s.price) : null, durationMin: s.duration ? Number(s.duration) : null })),
        hours: days.filter((d) => d.enabled).map((d) => ({ weekday: d.weekday, startMin: hhmmToMinutes(d.start), endMin: hhmmToMinutes(d.end), breakStartMin: hhmmToMinutes(d.bs), breakEndMin: hhmmToMinutes(d.be) })),
      });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Dados inválidos", "error");
    }
  }

  return (
    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <Card>
        <CardTitle>Dados do profissional</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" htmlFor="n" error={fe.name}><Input id="n" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
          <Field label="Nome profissional" htmlFor="dn" error={fe.displayName}><Input id="dn" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} required /></Field>
          <Field label="E-mail (receberá o convite)" htmlFor="e" error={fe.email}><Input id="e" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></Field>
          <Field label="Telefone" htmlFor="ph"><Input id="ph" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <ImageUpload value={f.photoUrl} onChange={(v) => setF({ ...f, photoUrl: v })} name={f.displayName || "Foto"} />
          <Field label="Especialidades" htmlFor="sp"><TagInput id="sp" value={f.specialties} onChange={(v) => setF({ ...f, specialties: v })} /></Field>
        </div>
        <Field label="Biografia" htmlFor="bio" className="mt-4"><Textarea id="bio" value={f.bio} maxLength={800} onChange={(e) => setF({ ...f, bio: e.target.value })} /></Field>
      </Card>

      <Card>
        <CardTitle>Serviços, preços e durações</CardTitle>
        <div className="space-y-2">
          {services.map((s, i) => (
            <div key={s.id} className="grid items-center gap-2 rounded-xl border border-line/60 bg-coal/40 p-3 sm:grid-cols-[1fr_130px_110px]">
              <Checkbox checked={svc[i].enabled} onChange={(e) => setSvc(svc.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x)))} label={s.name} description={`Padrão ${formatMoney(s.priceCents)} · ${s.durationMin} min`} />
              <Input aria-label={`Preço de ${s.name}`} placeholder="Preço padrão" className="h-9" value={svc[i].price} onChange={(e) => setSvc(svc.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
              <Input aria-label={`Duração de ${s.name}`} placeholder="min" className="h-9" value={svc[i].duration} onChange={(e) => setSvc(svc.map((x, j) => (j === i ? { ...x, duration: e.target.value } : x)))} />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>Disponibilidade</CardTitle>
        <div className="space-y-2">
          {days.map((d, i) => (
            <div key={d.weekday} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-28"><Checkbox checked={d.enabled} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x)))} label={WEEKDAY_LABELS[d.weekday]} /></span>
              {d.enabled && (
                <>
                  <Input type="time" className="h-9 w-28" aria-label="Início" value={d.start} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} />–
                  <Input type="time" className="h-9 w-28" aria-label="Fim" value={d.end} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} />
                  <span className="text-xs text-smoke">intervalo</span>
                  <Input type="time" className="h-9 w-28" aria-label="Início do intervalo" value={d.bs} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, bs: e.target.value } : x)))} />–
                  <Input type="time" className="h-9 w-28" aria-label="Fim do intervalo" value={d.be} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, be: e.target.value } : x)))} />
                </>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>Comissão e estação 3D</CardTitle>
        <CommissionFields v={comm} set={(p) => setComm({ ...comm, ...p })} />
        <Field label="Estação 3D atribuída" htmlFor="st" className="mt-4">
          <Select id="st" value={f.stationId} onChange={(e) => setF({ ...f, stationId: e.target.value })}>
            <option value="">Nenhuma por enquanto</option>
            {stations.map((s) => <option key={s.id} value={s.id} disabled={!!s.occupiedBy}>{s.name}{s.occupiedBy ? ` (ocupada por ${s.occupiedBy})` : ""}</option>)}
          </Select>
        </Field>
        {stations.every((s) => s.occupiedBy) && <Notice tone="warning">Todas as estações estão ocupadas. Adicione uma em “Minha Barbearia 3D” e publique.</Notice>}
      </Card>

      <SubmitButton pending={pending} size="lg">Cadastrar e gerar convite</SubmitButton>
    </form>
  );
}

// ─── Aprovação de solicitações ───────────────────────────────────────────────

export function RequestActions({ barberProfileId, name, stations, services }: { barberProfileId: string; name: string; stations: Station[]; services: ServiceOpt[] }) {
  const [mode, setMode] = useState<null | "approve" | "reject" | "info">(null);
  const [note, setNote] = useState("");
  const [comm, setComm] = useState({ commissionModel: "PERCENT", commissionPercent: "50", fixedFee: "0", partnershipType: "Comissionado" });
  const [stationId, setStationId] = useState("");
  const [serviceIds, setServiceIds] = useState(services.map((s) => s.id));
  const close = () => setMode(null);
  const approve = useAction(approvePartnerAction, { onSuccess: close });
  const reject = useAction((n: string) => rejectPartnerAction(barberProfileId, n), { onSuccess: close });
  const info = useAction((n: string) => requestInfoAction(barberProfileId, n), { onSuccess: close });
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={() => setMode("approve")}>Aprovar</Button>
      <Button size="sm" variant="secondary" onClick={() => setMode("info")}>Solicitar complementação</Button>
      <Button size="sm" variant="danger" onClick={() => setMode("reject")}>Rejeitar</Button>

      <Dialog open={mode === "approve"} onClose={close} title={`Aprovar ${name}`} wide>
        <div className="space-y-5">
          <CommissionFields v={comm} set={(p) => setComm({ ...comm, ...p })} />
          <Field label="Vincular estação 3D" htmlFor="ast">
            <Select id="ast" value={stationId} onChange={(e) => setStationId(e.target.value)}>
              <option value="">Definir depois</option>
              {stations.map((s) => <option key={s.id} value={s.id} disabled={!!s.occupiedBy}>{s.name}{s.occupiedBy ? ` (ocupada por ${s.occupiedBy})` : ""}</option>)}
            </Select>
          </Field>
          <fieldset className="rounded-xl border border-line p-4">
            <legend className="px-1 text-xs uppercase tracking-[0.14em] text-mist">Serviços habilitados</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {services.map((s) => <Checkbox key={s.id} checked={serviceIds.includes(s.id)} onChange={(e) => setServiceIds(e.target.checked ? [...serviceIds, s.id] : serviceIds.filter((x) => x !== s.id))} label={s.name} />)}
            </div>
          </fieldset>
          <p className="text-xs text-smoke">A jornada inicial copia o horário de funcionamento (com almoço 12h–13h) e pode ser ajustada depois.</p>
          <Button disabled={approve.pending} onClick={() => approve.run({ barberProfileId, commissionModel: comm.commissionModel, commissionPercent: Number(comm.commissionPercent) || 0, fixedFeeCents: parseMoneyToCents(comm.fixedFee) || 0, partnershipType: comm.partnershipType, stationId: stationId || null, serviceIds, copyHoursFromShop: true })}>
            Aprovar e ativar perfil profissional
          </Button>
        </div>
      </Dialog>
      <Dialog open={mode === "info"} onClose={close} title="Solicitar complementação">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Quais informações o candidato deve enviar?" aria-label="Mensagem" />
        <Button className="mt-4" disabled={info.pending} onClick={() => info.run(note)}>Enviar pedido</Button>
      </Dialog>
      <Dialog open={mode === "reject"} onClose={close} title="Rejeitar solicitação">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Motivo (será enviado ao candidato, opcional)" aria-label="Motivo" />
        <Button variant="danger" className="mt-4" disabled={reject.pending} onClick={() => reject.run(note)}>Confirmar rejeição</Button>
      </Dialog>
    </div>
  );
}

// ─── Detalhe do profissional ─────────────────────────────────────────────────

export function CommissionForm({ barberProfileId, initial }: { barberProfileId: string; initial: { commissionModel: string; commissionPercent: number; fixedFeeCents: number; partnershipType: string } }) {
  const [v, setV] = useState({ commissionModel: initial.commissionModel, commissionPercent: String(initial.commissionPercent), fixedFee: (initial.fixedFeeCents / 100).toFixed(2).replace(".", ","), partnershipType: initial.partnershipType });
  const { run, pending } = useAction((d: unknown) => updateCommissionAction(barberProfileId, d));
  return (
    <Card>
      <CardTitle>Comissão e parceria</CardTitle>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void run({ commissionModel: v.commissionModel, commissionPercent: Number(v.commissionPercent) || 0, fixedFeeCents: parseMoneyToCents(v.fixedFee) || 0, partnershipType: v.partnershipType }); }}>
        <CommissionFields v={v} set={(p) => setV({ ...v, ...p })} />
        <p className="text-xs text-smoke">Alterações valem para atendimentos concluídos a partir de agora. Comissões já registradas não são recalculadas.</p>
        <SubmitButton pending={pending}>Salvar regra</SubmitButton>
      </form>
    </Card>
  );
}

export function TeamAdminActions({ barberProfileId, status, isSelf, userId, isAdminUser, others, futureCount }: { barberProfileId: string; status: string; isSelf: boolean; userId: string | null; isAdminUser: boolean; others: Array<{ id: string; displayName: string }>; futureCount: number }) {
  const [open, setOpen] = useState(false);
  const [strategy, setStrategy] = useState<"CANCEL" | "REASSIGN">("CANCEL");
  const [target, setTarget] = useState(others[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const off = useAction(offboardBarberAction, { onSuccess: () => setOpen(false) });
  const regen = useAction(regenerateInviteAction, { onSuccess: (d) => d && setLink(`${window.location.origin}${d.link}`) });
  return (
    <Card>
      <CardTitle>Ações administrativas</CardTitle>
      <div className="flex flex-wrap gap-2">
        {status === "INVITED" && (
          <Button variant="outline" size="sm" disabled={regen.pending} onClick={() => regen.run(barberProfileId)}><Link2 className="h-3.5 w-3.5" /> Gerar novo link de convite</Button>
        )}
        {status === "APPROVED" && !isSelf && <Button variant="danger" size="sm" onClick={() => setOpen(true)}>Desligar profissional</Button>}
        {status === "INVITED" && <Button variant="danger" size="sm" onClick={() => setOpen(true)}>Cancelar convite</Button>}
        {status === "INACTIVE" && userId && <ActionButton action={() => reactivateBarberAction(barberProfileId)} variant="outline">Reativar</ActionButton>}
        {userId && !isSelf && status === "APPROVED" && (
          <ActionButton action={() => setAdminRoleAction(userId, !isAdminUser)} variant="ghost" confirm={isAdminUser ? "Remover acesso administrativo?" : "Conceder acesso total de proprietário/administrador a este profissional?"}>
            {isAdminUser ? "Remover acesso administrativo" : "Conceder acesso administrativo"}
          </ActionButton>
        )}
      </div>
      {link && (
        <div className="mt-3 flex gap-2">
          <Input readOnly value={link} aria-label="Novo link de convite" onFocus={(e) => e.target.select()} />
          <Button onClick={() => { void navigator.clipboard.writeText(link); toast("Link copiado."); }}><Copy className="h-4 w-4" /></Button>
        </div>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title="Desligar profissional">
        <p className="text-sm text-mist">Históricos operacionais e financeiros serão preservados. A estação 3D será liberada.</p>
        {futureCount > 0 ? (
          <div className="mt-4 space-y-3">
            <Notice tone="warning">Há {futureCount} atendimento(s) futuro(s). Escolha como tratá-los:</Notice>
            <label className="flex items-center gap-2 text-sm"><input type="radio" checked={strategy === "CANCEL"} onChange={() => setStrategy("CANCEL")} className="accent-[#c8a165]" /> Cancelar e notificar os clientes</label>
            <label className="flex items-center gap-2 text-sm"><input type="radio" checked={strategy === "REASSIGN"} onChange={() => setStrategy("REASSIGN")} disabled={!others.length} className="accent-[#c8a165]" /> Transferir para outro profissional (mesmo horário)</label>
            {strategy === "REASSIGN" && (
              <Select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Profissional de destino">
                {others.map((o) => <option key={o.id} value={o.id}>{o.displayName}</option>)}
              </Select>
            )}
            {strategy === "CANCEL" && <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Mensagem aos clientes (opcional)" aria-label="Mensagem" />}
          </div>
        ) : <p className="mt-3 text-sm text-smoke">Não há atendimentos futuros.</p>}
        <Button variant="danger" className="mt-5" disabled={off.pending} onClick={() => off.run({ barberProfileId, strategy, targetBarberProfileId: strategy === "REASSIGN" ? target : undefined, reason })}>Confirmar desligamento</Button>
      </Dialog>
    </Card>
  );
}
