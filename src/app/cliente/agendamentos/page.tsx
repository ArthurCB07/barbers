import { CalendarDays } from "lucide-react";
import { requireRole } from "@/server/auth/session";
import { requireShop } from "@/server/shop";
import { prisma } from "@/server/db";
import { EmptyState, LinkButton, PageHeader, Notice } from "@/components/ui/primitives";
import { AppointmentCard } from "@/features/appointments/AppointmentCard";
import { AppointmentActions } from "@/features/appointments/AppointmentActions";
import { toActionable } from "@/features/appointments/mapping";
import { todayIn } from "@/lib/time";

export const metadata = { title: "Meus agendamentos" };

export default async function MyAppointments() {
  const shop = await requireShop();
  const s = await requireRole("CLIENT");
  const upcoming = await prisma.appointment.findMany({
    where: { clientUserId: s.user.id, shopId: shop.id, status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS"] }, endsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
    include: { barber: true, service: true, station: true },
  });
  const today = todayIn(shop.timezone);
  return (
    <>
      <PageHeader title="Meus agendamentos" description="Reservas futuras. Remarque ou cancele respeitando a política da barbearia." actions={<LinkButton href="/cliente/agendar">Novo agendamento</LinkButton>} />
      <div className="mb-5">
        <Notice tone="info">{shop.cancellationPolicyText || `Alterações pelo site até ${shop.cancelPolicyHours}h antes do horário.`}</Notice>
      </div>
      {upcoming.length === 0 ? (
        <EmptyState icon={<CalendarDays className="h-8 w-8" />} title="Você não tem agendamentos futuros" action={<LinkButton href="/barbearia" variant="outline">Explorar a barbearia</LinkButton>} />
      ) : (
        <div className="space-y-3">
          {upcoming.map((a) => (
            <AppointmentCard key={a.id} a={a} tz={shop.timezone} actions={<AppointmentActions a={toActionable(a, { role: "CLIENT", policyHours: shop.cancelPolicyHours })} today={today} maxAdvanceDays={shop.maxAdvanceDays} />} />
          ))}
        </div>
      )}
    </>
  );
}
