import { requireRole } from "@/server/auth/session";
import { requireShop } from "@/server/shop";
import { prisma } from "@/server/db";
import { PageHeader } from "@/components/ui/primitives";
import { WorkingHoursEditor, TimeOffManager } from "@/features/barbers/ScheduleEditor";
import { formatDateTime, todayIn } from "@/lib/time";

export const metadata = { title: "Disponibilidade" };

export default async function Availability() {
  const shop = await requireShop();
  const s = await requireRole("BARBER");
  const id = s.actor.barberProfileId!;
  const [hours, timeOff] = await Promise.all([
    prisma.workingHours.findMany({ where: { barberProfileId: id } }),
    prisma.timeOff.findMany({ where: { barberProfileId: id, endsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Disponibilidade" description="Defina sua jornada, intervalos e registre folgas ou bloqueios." />
      <div className="grid gap-6 xl:grid-cols-2">
        <WorkingHoursEditor barberProfileId={id} hours={hours} />
        <TimeOffManager
          barberProfileId={id}
          today={todayIn(shop.timezone)}
          isAdmin={false}
          canBlock={shop.barberCanBlockAgenda}
          items={timeOff.map((t) => ({ id: t.id, kind: t.kind, status: t.status, reason: t.reason, label: `${formatDateTime(t.startsAt, shop.timezone)} → ${formatDateTime(t.endsAt, shop.timezone)}` }))}
        />
      </div>
    </>
  );
}
