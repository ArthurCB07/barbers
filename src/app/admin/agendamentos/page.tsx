import Link from "next/link";
import { requireRole } from "@/server/auth/session";
import { requireShop } from "@/server/shop";
import { prisma } from "@/server/db";
import { listBarberServices } from "@/server/services/appointments";
import { PageHeader } from "@/components/ui/primitives";
import { AgendaBoard, parseAgendaParams } from "@/features/appointments/AgendaBoard";
import { ManualBooking } from "@/features/appointments/ManualBooking";
import { cn } from "@/lib/utils";
import { todayIn } from "@/lib/time";

export const metadata = { title: "Agendamentos" };

export default async function AdminAppointments({ searchParams }: { searchParams: Promise<{ view?: string; date?: string; barber?: string }> }) {
  const shop = await requireShop();
  await requireRole("ADMIN");
  const sp = await searchParams;
  const { view, date } = parseAgendaParams(sp, shop.timezone);
  const [barbers, clientRoles] = await Promise.all([
    prisma.barberProfile.findMany({ where: { shopId: shop.id, status: "APPROVED", userId: { not: null } }, orderBy: { displayName: "asc" } }),
    prisma.roleAssignment.findMany({ where: { shopId: shop.id, role: "CLIENT", user: { anonymizedAt: null } }, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { user: { name: "asc" } } }),
  ]);
  const barberOptions = await Promise.all(barbers.map(async (b) => ({ id: b.id, displayName: b.displayName, services: await listBarberServices(b.id) })));
  const barberId = barbers.some((b) => b.id === sp.barber) ? sp.barber : undefined;
  const link = (id?: string) => `/admin/agendamentos?${new URLSearchParams({ view, date, ...(id ? { barber: id } : {}) })}`;
  return (
    <>
      <PageHeader
        title="Agendamentos"
        description="Visualize todas as agendas, filtre por profissional, confirme, remarque, cancele, registre comparecimento e pagamentos."
        actions={<ManualBooking clients={clientRoles.map((r) => r.user)} barbers={barberOptions} today={todayIn(shop.timezone)} maxAdvanceDays={shop.maxAdvanceDays} />}
      />
      <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Filtrar por profissional">
        <Link href={link()} className={cn("rounded-full border px-3 py-1 text-xs", !barberId ? "border-gold bg-gold/15 text-gold-soft" : "border-line text-mist")}>Todos</Link>
        {barbers.map((b) => (
          <Link key={b.id} href={link(b.id)} className={cn("rounded-full border px-3 py-1 text-xs", barberId === b.id ? "border-gold bg-gold/15 text-gold-soft" : "border-line text-mist")}>{b.displayName}</Link>
        ))}
      </div>
      <AgendaBoard shop={shop} barberProfileId={barberId} view={view} date={date} basePath="/admin/agendamentos" role="ADMIN" extraQuery={barberId ? { barber: barberId } : {}} />
    </>
  );
}
