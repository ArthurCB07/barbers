import { Download } from "lucide-react";
import { requireRole } from "@/server/auth/session";
import { requireShop } from "@/server/shop";
import { prisma } from "@/server/db";
import { financeSummary } from "@/server/services/finance";
import { Badge, Card, CardTitle, Notice, PageHeader, Select, StatCard, Table, Td, Th, STATUS_TONE } from "@/components/ui/primitives";
import { ActionButton } from "@/components/ui/client";
import { HBarList } from "@/components/ui/charts";
import { PayoutForm } from "@/features/finance/PayoutForm";
import { confirmPaymentAction, voidPaymentAction } from "@/server/actions/app";
import { formatMoney, safeJson } from "@/lib/utils";
import { addDays, formatDateTime, isValidDateStr, todayIn, zonedToUtc } from "@/lib/time";
import { PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL, type PaymentMethod } from "@/types/domain";

export const metadata = { title: "Financeiro" };

export default async function AdminFinance({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; barber?: string }> }) {
  const shop = await requireShop();
  await requireRole("ADMIN");
  const sp = await searchParams;
  const tz = shop.timezone;
  const to = sp.to && isValidDateStr(sp.to) ? sp.to : todayIn(tz);
  const from = sp.from && isValidDateStr(sp.from) ? sp.from : `${to.slice(0, 7)}-01`;
  const barberId = sp.barber || undefined;
  const [f, barbers, open] = await Promise.all([
    financeSummary(shop.id, { from: zonedToUtc(from, 0, tz), to: zonedToUtc(addDays(to, 1), 0, tz), barberProfileId: barberId }),
    prisma.barberProfile.findMany({ where: { shopId: shop.id, status: { in: ["APPROVED", "INACTIVE"] } }, orderBy: { displayName: "asc" } }),
    prisma.commission.findMany({ where: { status: "OPEN", barber: { shopId: shop.id } }, include: { barber: true, appointment: { include: { service: true } } }, orderBy: { createdAt: "asc" } }),
  ]);
  const openByBarber = new Map<string, { name: string; items: Array<{ id: string; label: string; amountCents: number }> }>();
  for (const c of open) {
    const row = openByBarber.get(c.barberProfileId) ?? { name: c.barber.displayName, items: [] };
    row.items.push({ id: c.id, label: `${formatDateTime(c.appointment.startsAt, tz)} · ${c.appointment.service.name}`, amountCents: c.amountCents });
    openByBarber.set(c.barberProfileId, row);
  }
  const fixed = barbers.filter((b) => b.commissionModel === "FIXED" && b.status === "APPROVED");
  const qs = new URLSearchParams({ from, to, ...(barberId ? { barberId } : {}) }).toString();
  return (
    <>
      <PageHeader title="Financeiro" description="Pagamentos presenciais registrados, comissões e repasses — tudo com dados persistidos e rastreáveis." />
      <Notice tone="info" title="Pagamentos online ainda não integrados">
        Pix automático, Mercado Pago e cartão online exigem credenciais e não estão ativos. Registre recebimentos presenciais (dinheiro, Pix manual, maquininha); registros de barbeiros ficam pendentes até sua confirmação.
      </Notice>
      <form className="my-5 flex flex-wrap items-end gap-3 text-sm">
        <label className="text-xs text-mist">De <input type="date" name="from" defaultValue={from} className="ml-1 rounded-lg border border-line bg-coal px-2 py-1 text-cream" /></label>
        <label className="text-xs text-mist">Até <input type="date" name="to" defaultValue={to} className="ml-1 rounded-lg border border-line bg-coal px-2 py-1 text-cream" /></label>
        <Select name="barber" defaultValue={barberId ?? ""} className="h-8 w-48 text-xs" aria-label="Profissional"><option value="">Todos os profissionais</option>{barbers.map((b) => <option key={b.id} value={b.id}>{b.displayName}</option>)}</Select>
        <button className="rounded-lg border border-gold/40 px-3 py-1 text-xs text-gold-soft">Filtrar</button>
        <span className="ml-auto flex flex-wrap gap-2">
          {[["appointments", "Atendimentos"], ["payments", "Pagamentos"], ["commissions", "Comissões"]].map(([t, l]) => (
            <a key={t} href={`/api/admin/export?type=${t}&${qs}`} className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1 text-xs text-mist hover:text-cream"><Download className="h-3.5 w-3.5" /> {l} CSV</a>
          ))}
        </span>
      </form>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Serviços concluídos" value={formatMoney(f.servicesValue)} hint={`${f.completed.length} atendimento(s)`} />
        <StatCard label="Recebido (confirmado)" value={formatMoney(f.confirmed)} tone="copper" />
        <StatCard label="Aguardando confirmação" value={formatMoney(f.pendingConfirmation)} tone="neutral" />
        <StatCard label="A receber dos clientes" value={formatMoney(f.unpaid)} tone="neutral" hint="concluídos sem pagamento confirmado" />
        <StatCard label="Comissões a repassar" value={formatMoney(f.openCommissionsAll)} hint={`No período: ${formatMoney(f.commissionTotal)}`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card><CardTitle>Receita por profissional</CardTitle><HBarList data={f.byBarber.map((b) => ({ label: b.name, value: b.value, hint: `comissão ${formatMoney(b.commission)}` }))} format={formatMoney} /></Card>
        <Card><CardTitle>Receita por serviço</CardTitle><HBarList data={f.byService.map((s) => ({ label: s.name, value: s.value, hint: `${s.count}×` }))} format={formatMoney} /></Card>
      </div>

      <Card className="mt-6">
        <CardTitle>Pagamentos</CardTitle>
        <Table>
          <thead><tr><Th>Registrado</Th><Th>Cliente / serviço</Th><Th>Profissional</Th><Th>Método</Th><Th>Valor</Th><Th>Estado</Th><Th></Th></tr></thead>
          <tbody>
            {f.payments.length === 0 && <tr><Td colSpan={7} className="text-center text-smoke">Nenhum pagamento no período.</Td></tr>}
            {f.payments.map((p) => (
              <tr key={p.id}>
                <Td className="text-xs">{formatDateTime(p.createdAt, tz)}</Td>
                <Td>{p.appointment.client.name}<span className="block text-xs text-smoke">{p.appointment.service.name}{p.reference && ` · ref. ${p.reference}`}</span></Td>
                <Td>{p.appointment.barber.displayName}</Td>
                <Td className="text-xs">{PAYMENT_METHOD_LABEL[p.method as PaymentMethod]}<span className="block text-smoke">Registro manual</span></Td>
                <Td className="text-cream">{formatMoney(p.amountCents)}</Td>
                <Td><Badge tone={STATUS_TONE[p.status]}>{PAYMENT_STATUS_LABEL[p.status]}</Badge></Td>
                <Td>
                  <span className="flex gap-1">
                    {p.status === "PENDING" && <ActionButton action={confirmPaymentAction.bind(null, p.id)} variant="outline">Confirmar</ActionButton>}
                    {p.status !== "VOIDED" && <ActionButton action={voidPaymentAction.bind(null, p.id)} variant="ghost" confirm="Anular este pagamento?">Anular</ActionButton>}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Registrar repasses</CardTitle>
          {openByBarber.size === 0 ? <p className="text-sm text-smoke">Nenhuma comissão em aberto.</p> : (
            <div className="space-y-3">{[...openByBarber.entries()].map(([id, r]) => <PayoutForm key={id} barberProfileId={id} barberName={r.name} items={r.items} />)}</div>
          )}
          {fixed.length > 0 && (
            <div className="mt-4 rounded-xl border border-line p-3 text-xs text-mist">
              <p className="mb-1 font-semibold uppercase tracking-[0.12em] text-smoke">Parcerias com valor fixo (obrigações à parte)</p>
              {fixed.map((b) => <p key={b.id}>{b.displayName}: {formatMoney(b.fixedFeeCents)} acordado</p>)}
            </div>
          )}
        </Card>
        <Card>
          <CardTitle>Detalhamento das comissões (período)</CardTitle>
          <ul className="max-h-96 space-y-1.5 overflow-y-auto text-xs">
            {f.commissions.length === 0 && <li className="text-smoke">Nenhuma comissão no período.</li>}
            {f.commissions.map((c) => (
              <li key={c.id} className="rounded-lg border border-line/60 px-3 py-2">
                <div className="flex justify-between gap-2"><span className="text-cream">{c.barber.displayName} · {c.appointment.service.name}</span><span className="text-gold-soft">{formatMoney(c.amountCents)}</span></div>
                <p className="text-smoke">{formatDateTime(c.appointment.startsAt, tz)} · base {formatMoney(c.baseCents)} × {c.percent}% — {safeJson<{ explanation?: string }>(c.ruleSnapshot, {}).explanation} · {c.status === "PAID" ? "repassada" : "em aberto"}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      {f.payouts.length > 0 && (
        <Card className="mt-6">
          <CardTitle>Repasses no período</CardTitle>
          <ul className="space-y-1 text-sm">{f.payouts.map((p) => <li key={p.id} className="flex justify-between text-mist"><span>{formatDateTime(p.createdAt, tz)} · {p.barber.displayName} {p.note && `· ${p.note}`}</span><span className="text-cream">{formatMoney(p.amountCents)}</span></li>)}</ul>
        </Card>
      )}
    </>
  );
}
