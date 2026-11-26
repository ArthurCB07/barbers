import { requireRole } from "@/server/auth/session";
import { requireShop } from "@/server/shop";
import { prisma } from "@/server/db";
import { financeSummary } from "@/server/services/finance";
import { Badge, Card, CardTitle, Notice, PageHeader, StatCard, Table, Td, Th, STATUS_TONE } from "@/components/ui/primitives";
import { formatMoney, safeJson } from "@/lib/utils";
import { addDays, formatDateTime, isValidDateStr, todayIn, zonedToUtc } from "@/lib/time";
import { COMMISSION_MODEL_LABEL, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL, type CommissionModel, type PaymentMethod } from "@/types/domain";

export const metadata = { title: "Financeiro" };

export default async function BarberFinance({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const shop = await requireShop();
  const s = await requireRole("BARBER");
  const id = s.actor.barberProfileId!;
  const sp = await searchParams;
  const tz = shop.timezone;
  const to = sp.to && isValidDateStr(sp.to) ? sp.to : todayIn(tz);
  const from = sp.from && isValidDateStr(sp.from) ? sp.from : `${to.slice(0, 7)}-01`;
  const [f, profile] = await Promise.all([
    financeSummary(shop.id, { from: zonedToUtc(from, 0, tz), to: zonedToUtc(addDays(to, 1), 0, tz), barberProfileId: id }),
    prisma.barberProfile.findUniqueOrThrow({ where: { id } }),
  ]);
  return (
    <>
      <PageHeader title="Financeiro" description="Valores gerados, comissões calculadas e repasses registrados. As regras de comissão são definidas pelo proprietário." />
      <form className="mb-5 flex flex-wrap items-end gap-3 text-sm">
        <label className="text-xs text-mist">De <input type="date" name="from" defaultValue={from} className="ml-1 rounded-lg border border-line bg-coal px-2 py-1 text-cream" /></label>
        <label className="text-xs text-mist">Até <input type="date" name="to" defaultValue={to} className="ml-1 rounded-lg border border-line bg-coal px-2 py-1 text-cream" /></label>
        <button className="rounded-lg border border-gold/40 px-3 py-1 text-xs text-gold-soft">Filtrar</button>
      </form>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Valor dos serviços concluídos" value={formatMoney(f.servicesValue)} hint={`${f.completed.length} atendimento(s)`} />
        <StatCard label="Comissões no período" value={formatMoney(f.commissionTotal)} tone="copper" />
        <StatCard label="Pendente de repasse (total)" value={formatMoney(f.openCommissionsAll)} />
        <StatCard label="Repasses no período" value={formatMoney(f.payoutsTotal)} tone="neutral" />
      </div>
      <div className="mt-4">
        <Notice tone="info" title={`Sua regra atual: ${COMMISSION_MODEL_LABEL[profile.commissionModel as CommissionModel]}`}>
          {profile.commissionModel === "FIXED"
            ? `Valor integral dos serviços para você. Obrigação fixa acordada: ${formatMoney(profile.fixedFeeCents)} (registrada à parte).`
            : `${profile.commissionPercent}% sobre o valor de cada serviço${profile.commissionModel === "PER_SERVICE" ? " (ou o percentual específico do serviço)" : ""}. Comissões já registradas não mudam se a regra for alterada.`}
        </Notice>
      </div>
      <Card className="mt-6">
        <CardTitle>Detalhamento das comissões</CardTitle>
        <Table>
          <thead><tr><Th>Atendimento</Th><Th>Serviço</Th><Th>Base</Th><Th>Cálculo</Th><Th>Comissão</Th><Th>Estado</Th></tr></thead>
          <tbody>
            {f.commissions.length === 0 && <tr><Td colSpan={6} className="text-center text-smoke">Nenhuma comissão no período.</Td></tr>}
            {f.commissions.map((c) => (
              <tr key={c.id}>
                <Td>{formatDateTime(c.appointment.startsAt, tz)}</Td>
                <Td>{c.appointment.service.name}</Td>
                <Td>{formatMoney(c.baseCents)}</Td>
                <Td className="text-xs">{safeJson<{ explanation?: string }>(c.ruleSnapshot, {}).explanation ?? `${c.percent}%`}</Td>
                <Td className="font-medium text-cream">{formatMoney(c.amountCents)}</Td>
                <Td><Badge tone={STATUS_TONE[c.status]}>{c.status === "PAID" ? "Repassada" : "Em aberto"}</Badge></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Pagamentos registrados</CardTitle>
          <ul className="space-y-2 text-sm">
            {f.payments.length === 0 && <li className="text-smoke">Nenhum pagamento no período.</li>}
            {f.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line/60 px-3 py-2">
                <span className="text-mist">{p.appointment.client.name} · {PAYMENT_METHOD_LABEL[p.method as PaymentMethod]}</span>
                <span className="flex items-center gap-2"><Badge tone={STATUS_TONE[p.status]}>{PAYMENT_STATUS_LABEL[p.status]}</Badge><span className="text-cream">{formatMoney(p.amountCents)}</span></span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardTitle>Repasses</CardTitle>
          <ul className="space-y-2 text-sm">
            {f.payouts.length === 0 && <li className="text-smoke">Nenhum repasse no período.</li>}
            {f.payouts.map((p) => (
              <li key={p.id} className="flex justify-between rounded-lg border border-line/60 px-3 py-2">
                <span className="text-mist">{formatDateTime(p.createdAt, tz)} {p.note && `· ${p.note}`}</span>
                <span className="text-cream">{formatMoney(p.amountCents)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
