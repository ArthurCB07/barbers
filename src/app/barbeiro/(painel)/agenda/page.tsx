import { requireRole } from "@/server/auth/session";
import { requireShop } from "@/server/shop";
import { PageHeader } from "@/components/ui/primitives";
import { AgendaBoard, parseAgendaParams } from "@/features/appointments/AgendaBoard";

export const metadata = { title: "Agenda" };

export default async function BarberAgenda({ searchParams }: { searchParams: Promise<{ view?: string; date?: string }> }) {
  const shop = await requireShop();
  const s = await requireRole("BARBER");
  const { view, date } = parseAgendaParams(await searchParams, shop.timezone);
  return (
    <>
      <PageHeader title="Minha agenda" description="Agenda independente: somente os seus atendimentos aparecem aqui." />
      <AgendaBoard shop={shop} barberProfileId={s.actor.barberProfileId!} view={view} date={date} basePath="/barbeiro/agenda" role="BARBER" />
    </>
  );
}
