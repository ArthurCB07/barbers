import { requireRole } from "@/server/auth/session";
import { requireShop } from "@/server/shop";
import { stationOptions, serviceOptions } from "@/server/services/team-queries";
import { PageHeader } from "@/components/ui/primitives";
import { InviteBarberForm } from "@/features/partners/TeamForms";

export const metadata = { title: "Adicionar barbeiro" };

export default async function NewBarber() {
  const shop = await requireShop();
  await requireRole("ADMIN");
  const [stations, services] = await Promise.all([stationOptions(shop.id), serviceOptions(shop.id)]);
  return (
    <>
      <PageHeader eyebrow="Equipe e Parceiros" title="+ Adicionar Barbeiro" description="Configure perfil, serviços, preços, disponibilidade, comissão e estação. Um convite seguro é gerado para o profissional concluir o cadastro." />
      <InviteBarberForm stations={stations} services={services} />
    </>
  );
}
