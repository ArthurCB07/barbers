import { requireRole } from "@/server/auth/session";
import { requireShop } from "@/server/shop";
import { prisma } from "@/server/db";
import { getDraftScene } from "@/server/services/scene";
import { getViewer } from "@/server/viewer";
import { PageHeader } from "@/components/ui/primitives";
import { LayoutEditor } from "@/features/barbershop-3d/LayoutEditor";
import { todayIn } from "@/lib/time";

export const metadata = { title: "Minha Barbearia 3D" };

export default async function MyBarbershop3D() {
  const shop = await requireShop();
  const s = await requireRole("ADMIN");
  const [draft, barbers, { viewer }] = await Promise.all([
    getDraftScene(s.actor),
    prisma.barberProfile.findMany({ where: { shopId: shop.id, status: { in: ["APPROVED", "INVITED"] } }, orderBy: { displayName: "asc" } }),
    getViewer("/admin/barbearia-3d"),
  ]);
  return (
    <>
      <PageHeader eyebrow="Personalização" title="Minha Barbearia 3D" description="Adicione estações, vincule profissionais e personalize o ambiente. As mudanças ficam em rascunho até você publicar — só então os clientes as veem." />
      <LayoutEditor draft={draft} barbers={barbers.map((b) => ({ id: b.id, displayName: b.displayName, status: b.status }))} viewer={viewer} today={todayIn(shop.timezone)} />
    </>
  );
}
