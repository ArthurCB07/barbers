import { requireRole } from "@/server/auth/session";
import { requireShop } from "@/server/shop";
import { prisma } from "@/server/db";
import { getPublishedScene } from "@/server/services/scene";
import { getViewer } from "@/server/viewer";
import { Notice, PageHeader } from "@/components/ui/primitives";
import { BarbershopExperience } from "@/features/barbershop-3d/BarbershopExperience";
import { BarberProfileEditor, BarberServicesEditor } from "@/features/barbers/BarberEditors";
import { safeJson } from "@/lib/utils";
import { todayIn } from "@/lib/time";

export const metadata = { title: "Meu espaço 3D" };

export default async function MySpace() {
  const shop = await requireShop();
  const s = await requireRole("BARBER");
  const id = s.actor.barberProfileId!;
  const [profile, scene, services, { viewer }] = await Promise.all([
    prisma.barberProfile.findUniqueOrThrow({ where: { id }, include: { station: true, services: true } }),
    getPublishedScene(shop.id),
    prisma.service.findMany({ where: { shopId: shop.id, active: true }, orderBy: { sortOrder: "asc" } }),
    getViewer("/barbeiro/meu-espaco"),
  ]);
  return (
    <>
      <PageHeader title="Meu espaço 3D" description="Sua estação dentro da barbearia virtual e as informações que os clientes veem." />
      {!profile.station ? (
        <Notice tone="warning">Você ainda não tem uma estação atribuída. O proprietário pode vincular uma cadeira em “Minha Barbearia 3D”.</Notice>
      ) : (
        <div className="h-[460px] overflow-hidden rounded-2xl border border-line">
          <BarbershopExperience initialData={scene} viewer={viewer} today={todayIn(shop.timezone)} maxAdvanceDays={shop.maxAdvanceDays} initialStationId={profile.station.id} variant="focus" embedded showPanel={false} />
        </div>
      )}
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <BarberProfileEditor barberProfileId={id} initial={{ displayName: profile.displayName, bio: profile.bio, specialties: safeJson<string[]>(profile.specialties, []), experience: profile.experience, photoUrl: profile.photoUrl }} />
        <BarberServicesEditor
          barberProfileId={id}
          canEdit={shop.barberCanEditPrices}
          showCommission={false}
          services={services.map((sv) => {
            const bs = profile.services.find((x) => x.serviceId === sv.id);
            return { serviceId: sv.id, name: sv.name, basePrice: sv.priceCents, baseDuration: sv.durationMin, enabled: bs?.active ?? false, priceCents: bs?.priceCents ?? null, durationMin: bs?.durationMin ?? null, commissionPercent: bs?.commissionPercent ?? null };
          })}
        />
      </div>
    </>
  );
}
