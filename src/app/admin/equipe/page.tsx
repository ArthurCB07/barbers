import Link from "next/link";
import { Plus, MapPin } from "lucide-react";
import { requireRole } from "@/server/auth/session";
import { requireShop } from "@/server/shop";
import { prisma } from "@/server/db";
import { Avatar, Badge, Card, LinkButton, PageHeader, STATUS_TONE } from "@/components/ui/primitives";
import { BARBER_STATUS_LABEL, COMMISSION_MODEL_LABEL, type BarberStatus, type CommissionModel } from "@/types/domain";
import { formatMoney, safeJson } from "@/lib/utils";

export const metadata = { title: "Equipe e Parceiros" };

export default async function TeamPage() {
  const shop = await requireShop();
  await requireRole("ADMIN");
  const barbers = await prisma.barberProfile.findMany({
    where: { shopId: shop.id, status: { in: ["APPROVED", "INVITED", "INACTIVE"] } },
    include: { station: true, _count: { select: { appointments: { where: { startsAt: { gte: new Date() }, status: { in: ["PENDING", "CONFIRMED"] } } } } } },
    orderBy: [{ status: "asc" }, { displayName: "asc" }],
  });
  const pending = await prisma.barberProfile.count({ where: { shopId: shop.id, status: "PENDING" } });
  return (
    <>
      <PageHeader
        title="Equipe e Parceiros"
        description="Profissionais, estações 3D, comissões e próximos atendimentos."
        actions={<><LinkButton href="/admin/solicitacoes" variant="outline">Solicitações {pending > 0 && <Badge tone="gold">{pending}</Badge>}</LinkButton><LinkButton href="/admin/equipe/novo"><Plus className="h-4 w-4" /> Adicionar Barbeiro</LinkButton></>}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {barbers.map((b) => (
          <Link key={b.id} href={`/admin/equipe/${b.id}`} className="group">
            <Card className={`h-full transition group-hover:border-gold/40 ${b.status === "INACTIVE" ? "opacity-60" : ""}`}>
              <div className="flex items-start gap-4">
                <Avatar name={b.displayName} src={b.photoUrl} size={60} />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-xl text-cream">{b.displayName}</p>
                  <Badge tone={STATUS_TONE[b.status]} className="mt-1">{BARBER_STATUS_LABEL[b.status as BarberStatus]}</Badge>
                </div>
              </div>
              <p className="mt-3 truncate text-xs text-smoke">{safeJson<string[]>(b.specialties, []).join(" · ") || "Sem especialidades"}</p>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div><dt className="text-smoke">Estação 3D</dt><dd className="flex items-center gap-1 text-mist"><MapPin className="h-3 w-3 text-gold" />{b.station?.name ?? "—"}</dd></div>
                <div><dt className="text-smoke">Próximos</dt><dd className="text-mist">{b._count.appointments} atendimento(s)</dd></div>
                <div className="col-span-2"><dt className="text-smoke">Comissão</dt><dd className="text-mist">{COMMISSION_MODEL_LABEL[b.commissionModel as CommissionModel]} · {b.commissionModel === "FIXED" ? formatMoney(b.fixedFeeCents) : `${b.commissionPercent}%`}</dd></div>
              </dl>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
