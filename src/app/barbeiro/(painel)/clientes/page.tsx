import { Users } from "lucide-react";
import { requireRole } from "@/server/auth/session";
import { requireShop } from "@/server/shop";
import { prisma } from "@/server/db";
import { Avatar, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "Clientes" };

/** Somente clientes com atendimentos atribuídos a este profissional */
export default async function BarberClients() {
  const shop = await requireShop();
  const s = await requireRole("BARBER");
  const id = s.actor.barberProfileId!;
  const appts = await prisma.appointment.findMany({
    where: { barberProfileId: id, shopId: shop.id },
    orderBy: { startsAt: "desc" },
    include: { service: true, client: { select: { id: true, name: true, anonymizedAt: true, clientProfiles: { where: { shopId: shop.id }, select: { preferences: true, sharePreferences: true } } } } },
    take: 500,
  });
  const byClient = new Map<string, { name: string; prefs: string | null; items: typeof appts }>();
  for (const a of appts) {
    if (a.client.anonymizedAt) continue;
    const cp = a.client.clientProfiles[0];
    const row = byClient.get(a.client.id) ?? { name: a.client.name, prefs: cp?.sharePreferences && cp.preferences ? cp.preferences : null, items: [] };
    row.items.push(a);
    byClient.set(a.client.id, row);
  }
  const now = new Date();
  return (
    <>
      <PageHeader title="Meus clientes" description="Informações necessárias para os seus atendimentos. Dados de clientes de outros profissionais não são exibidos." />
      {byClient.size === 0 ? (
        <EmptyState icon={<Users className="h-8 w-8" />} title="Nenhum cliente ainda" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {[...byClient.entries()].map(([cid, c]) => {
            const next = c.items.filter((a) => a.startsAt > now && ["PENDING", "CONFIRMED"].includes(a.status)).at(-1);
            const done = c.items.filter((a) => a.status === "COMPLETED");
            return (
              <Card key={cid}>
                <div className="flex items-center gap-3">
                  <Avatar name={c.name} size={44} />
                  <div>
                    <p className="font-medium text-cream">{c.name}</p>
                    <p className="text-xs text-smoke">{done.length} atendimento(s) concluído(s) com você</p>
                  </div>
                </div>
                {next && <p className="mt-3 rounded-lg bg-gold/10 px-3 py-2 text-sm text-gold-soft">Próximo: {formatDateTime(next.startsAt, shop.timezone)} · {next.service.name}</p>}
                <p className="mt-3 text-xs uppercase tracking-[0.14em] text-smoke">Preferências autorizadas</p>
                <p className="text-sm text-mist">{c.prefs ?? "O cliente não compartilhou preferências."}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.14em] text-smoke">Histórico com você</p>
                <ul className="mt-1 space-y-0.5 text-xs text-mist">
                  {done.slice(0, 4).map((a) => <li key={a.id}>{formatDateTime(a.startsAt, shop.timezone)} · {a.service.name}</li>)}
                  {done.length === 0 && <li className="text-smoke">—</li>}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
