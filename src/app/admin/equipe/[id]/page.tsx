import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/server/auth/session";
import { requireShop } from "@/server/shop";
import { prisma } from "@/server/db";
import { Avatar, Badge, Card, CardTitle, PageHeader, STATUS_TONE } from "@/components/ui/primitives";
import { CommissionForm, TeamAdminActions } from "@/features/partners/TeamForms";
import { BarberProfileEditor, BarberServicesEditor } from "@/features/barbers/BarberEditors";
import { WorkingHoursEditor, TimeOffManager } from "@/features/barbers/ScheduleEditor";
import { BARBER_STATUS_LABEL, type BarberStatus } from "@/types/domain";
import { formatDateTime, todayIn } from "@/lib/time";
import { safeJson } from "@/lib/utils";

export default async function BarberDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shop = await requireShop();
  const s = await requireRole("ADMIN");
  const b = await prisma.barberProfile.findFirst({ where: { id, shopId: shop.id }, include: { station: true, services: true, workingHours: true, user: { select: { email: true, phone: true } }, invites: { orderBy: { createdAt: "desc" }, take: 1 } } });
  if (!b) notFound();
  const [services, timeOff, others, futureCount, adminRole] = await Promise.all([
    prisma.service.findMany({ where: { shopId: shop.id }, orderBy: { sortOrder: "asc" } }),
    prisma.timeOff.findMany({ where: { barberProfileId: id, endsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" } }),
    prisma.barberProfile.findMany({ where: { shopId: shop.id, status: "APPROVED", userId: { not: null }, id: { not: id } } }),
    prisma.appointment.count({ where: { barberProfileId: id, startsAt: { gt: new Date() }, status: { in: ["PENDING", "CONFIRMED"] } } }),
    b.userId ? prisma.roleAssignment.findFirst({ where: { userId: b.userId, shopId: shop.id, role: "ADMIN" } }) : null,
  ]);
  return (
    <>
      <PageHeader eyebrow="Equipe e Parceiros" title={b.displayName} description={b.user ? `${b.user.email} · ${b.user.phone}` : `Convite enviado para ${b.invites[0]?.email ?? "—"} (expira ${b.invites[0] ? formatDateTime(b.invites[0].expiresAt, shop.timezone) : "—"})`} actions={<Link href="/admin/barbearia-3d" className="text-sm text-gold-soft">Estação: {b.station?.name ?? "nenhuma"} →</Link>} />
      <div className="mb-6 flex items-center gap-3">
        <Avatar name={b.displayName} src={b.photoUrl} size={56} />
        <Badge tone={STATUS_TONE[b.status]}>{BARBER_STATUS_LABEL[b.status as BarberStatus]}</Badge>
        {adminRole && <Badge tone="gold">Administrador</Badge>}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <CommissionForm barberProfileId={id} initial={b} />
        <TeamAdminActions barberProfileId={id} status={b.status} isSelf={b.userId === s.user.id} userId={b.userId} isAdminUser={!!adminRole} others={others.map((o) => ({ id: o.id, displayName: o.displayName }))} futureCount={futureCount} />
        <BarberServicesEditor
          barberProfileId={id}
          canEdit
          showCommission
          services={services.map((sv) => {
            const bs = b.services.find((x) => x.serviceId === sv.id);
            return { serviceId: sv.id, name: sv.name, basePrice: sv.priceCents, baseDuration: sv.durationMin, enabled: bs?.active ?? false, priceCents: bs?.priceCents ?? null, durationMin: bs?.durationMin ?? null, commissionPercent: bs?.commissionPercent ?? null };
          })}
        />
        <BarberProfileEditor barberProfileId={id} initial={{ displayName: b.displayName, bio: b.bio, specialties: safeJson<string[]>(b.specialties, []), experience: b.experience, photoUrl: b.photoUrl }} />
        <WorkingHoursEditor barberProfileId={id} hours={b.workingHours} />
        <TimeOffManager barberProfileId={id} today={todayIn(shop.timezone)} isAdmin canBlock items={timeOff.map((t) => ({ id: t.id, kind: t.kind, status: t.status, reason: t.reason, label: `${formatDateTime(t.startsAt, shop.timezone)} → ${formatDateTime(t.endsAt, shop.timezone)}` }))} />
      </div>
      {b.experience && (
        <Card className="mt-6"><CardTitle>Experiência informada</CardTitle><p className="text-sm text-mist">{b.experience}</p></Card>
      )}
    </>
  );
}
