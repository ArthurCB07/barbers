import { requireRole } from "@/server/auth/session";
import { requireShop } from "@/server/shop";
import { getPublishedScene } from "@/server/services/scene";
import { getViewer } from "@/server/viewer";
import { BarbershopExperience } from "@/features/barbershop-3d/BarbershopExperience";
import { todayIn } from "@/lib/time";

/** Agendamento em 2D (alternativa acessível ao cenário 3D) */
export default async function BookPage() {
  const shop = await requireShop();
  await requireRole("CLIENT");
  const [data, { viewer }] = await Promise.all([getPublishedScene(shop.id), getViewer("/cliente/agendar")]);
  return (
    <div className="-mx-4 -my-6 sm:-mx-6 sm:-my-8">
      <BarbershopExperience initialData={data} viewer={viewer} today={todayIn(shop.timezone)} maxAdvanceDays={shop.maxAdvanceDays} force2D embedded />
    </div>
  );
}
