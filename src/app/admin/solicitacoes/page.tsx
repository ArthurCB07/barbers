import { Inbox } from "lucide-react";
import { requireRole } from "@/server/auth/session";
import { requireShop } from "@/server/shop";
import { prisma } from "@/server/db";
import { stationOptions, serviceOptions } from "@/server/services/team-queries";
import { Avatar, Badge, Card, EmptyState, PageHeader, STATUS_TONE } from "@/components/ui/primitives";
import { RequestActions } from "@/features/partners/TeamForms";
import { safeJson } from "@/lib/utils";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "Solicitações de Parceiros" };

export default async function PartnerRequests() {
  const shop = await requireShop();
  await requireRole("ADMIN");
  const [requests, history, stations, services] = await Promise.all([
    prisma.partnerRequest.findMany({ where: { shopId: shop.id, status: { in: ["PENDING", "NEEDS_INFO"] } }, include: { barber: { include: { user: { select: { email: true, phone: true, name: true } } } } }, orderBy: { createdAt: "asc" } }),
    prisma.partnerRequest.findMany({ where: { shopId: shop.id, status: { in: ["APPROVED", "REJECTED"] } }, include: { barber: true }, orderBy: { updatedAt: "desc" }, take: 15 }),
    stationOptions(shop.id),
    serviceOptions(shop.id),
  ]);
  return (
    <>
      <PageHeader title="Solicitações de Parceiros" description="Candidatos que escolheram “Sou Barbeiro”. Nenhum deles acessa a agenda da equipe antes da sua aprovação." />
      {requests.length === 0 ? (
        <EmptyState icon={<Inbox className="h-8 w-8" />} title="Nenhuma solicitação pendente" />
      ) : (
        <div className="space-y-4">
          {requests.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-col gap-4 lg:flex-row">
                <Avatar name={r.barber.displayName} src={r.barber.photoUrl} size={72} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-2xl text-cream">{r.barber.displayName}</p>
                    <Badge tone={STATUS_TONE[r.status]}>{r.status === "PENDING" ? "Aguardando análise" : "Aguardando complementação"}</Badge>
                  </div>
                  <p className="text-xs text-smoke">{r.barber.user?.name} · {r.barber.user?.email} · {r.barber.user?.phone} · enviada {formatDateTime(r.createdAt, shop.timezone)}</p>
                  <p className="mt-3 text-sm text-mist">{r.barber.bio}</p>
                  <div className="mt-2 flex flex-wrap gap-1">{safeJson<string[]>(r.barber.specialties, []).map((s) => <Badge key={s} tone="gold">{s}</Badge>)}</div>
                  {r.barber.experience && <p className="mt-2 text-xs text-smoke"><strong className="text-mist">Experiência:</strong> {r.barber.experience}</p>}
                  {r.message && <p className="mt-2 text-xs italic text-smoke">“{r.message}”</p>}
                  {r.reviewerNote && r.status === "NEEDS_INFO" && <p className="mt-2 text-xs text-info">Pedido enviado: {r.reviewerNote}</p>}
                </div>
                <div className="lg:w-72">
                  <RequestActions barberProfileId={r.barberProfileId} name={r.barber.displayName} stations={stations} services={services} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      {history.length > 0 && (
        <Card className="mt-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-mist">Histórico recente</p>
          <ul className="space-y-1 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex justify-between gap-3 text-mist"><span>{h.barber.displayName}</span><span className="flex items-center gap-2 text-xs text-smoke">{h.reviewedAt && formatDateTime(h.reviewedAt, shop.timezone)}<Badge tone={STATUS_TONE[h.status]}>{h.status === "APPROVED" ? "Aprovado" : "Rejeitado"}</Badge></span></li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
