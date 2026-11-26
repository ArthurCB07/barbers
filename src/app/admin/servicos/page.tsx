import { requireRole } from "@/server/auth/session";
import { requireShop } from "@/server/shop";
import { prisma } from "@/server/db";
import { PageHeader } from "@/components/ui/primitives";
import { ServiceManager } from "@/features/services/ServiceManager";

export const metadata = { title: "Serviços" };

export default async function AdminServices() {
  const shop = await requireShop();
  await requireRole("ADMIN");
  const [services, categories, barbers] = await Promise.all([
    prisma.service.findMany({ where: { shopId: shop.id }, orderBy: { sortOrder: "asc" }, include: { barbers: { where: { active: true }, select: { barberProfileId: true } } } }),
    prisma.serviceCategory.findMany({ where: { shopId: shop.id }, orderBy: { sortOrder: "asc" } }),
    prisma.barberProfile.findMany({ where: { shopId: shop.id, status: { in: ["APPROVED", "INVITED"] } }, orderBy: { displayName: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Serviços" description="Cadastre serviços, valores, durações e quem pode realizá-los — sem editar código." />
      <ServiceManager
        services={services.map((s) => ({ id: s.id, name: s.name, description: s.description, priceCents: s.priceCents, durationMin: s.durationMin, categoryId: s.categoryId, imageUrl: s.imageUrl, active: s.active, barberIds: s.barbers.map((b) => b.barberProfileId) }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        barbers={barbers.map((b) => ({ id: b.id, displayName: b.displayName }))}
      />
    </>
  );
}
