import { History } from "lucide-react";
import { requireRole } from "@/server/auth/session";
import { requireShop } from "@/server/shop";
import { prisma } from "@/server/db";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/primitives";
import { AppointmentCard } from "@/features/appointments/AppointmentCard";
import { formatMoney } from "@/lib/utils";

export const metadata = { title: "Histórico" };

export default async function HistoryPage() {
  const shop = await requireShop();
  const s = await requireRole("CLIENT");
  const past = await prisma.appointment.findMany({
    where: { clientUserId: s.user.id, shopId: shop.id, OR: [{ endsAt: { lt: new Date() } }, { status: { in: ["COMPLETED", "CANCELLED", "NO_SHOW"] } }] },
    orderBy: { startsAt: "desc" },
    take: 100,
    include: { barber: true, service: true, station: true },
  });
  const completed = past.filter((p) => p.status === "COMPLETED");
  return (
    <>
      <PageHeader title="Histórico" description="Atendimentos anteriores, cancelados e concluídos." />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Atendimentos concluídos" value={completed.length} />
        <StatCard label="Investido em cuidado" value={formatMoney(completed.reduce((t, a) => t + a.priceCents, 0))} tone="copper" />
        <StatCard label="Cancelados" value={past.filter((p) => p.status === "CANCELLED").length} tone="neutral" />
      </div>
      {past.length === 0 ? (
        <EmptyState icon={<History className="h-8 w-8" />} title="Seu histórico aparecerá aqui" />
      ) : (
        <div className="space-y-3">
          {past.map((a) => (
            <AppointmentCard key={a.id} a={a} tz={shop.timezone} />
          ))}
        </div>
      )}
    </>
  );
}
