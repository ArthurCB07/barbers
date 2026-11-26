import { notFound } from "next/navigation";
import { requireRole } from "@/server/auth/session";
import { requireShop } from "@/server/shop";
import { prisma } from "@/server/db";
import { Card, CardTitle, PageHeader, StatCard } from "@/components/ui/primitives";
import { AppointmentCard } from "@/features/appointments/AppointmentCard";
import { ClientNoteForm } from "@/features/clients/ClientNoteForm";
import { formatDateTime } from "@/lib/time";
import { formatMoney } from "@/lib/utils";

export default async function AdminClientDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shop = await requireShop();
  await requireRole("ADMIN");
  const role = await prisma.roleAssignment.findFirst({ where: { userId: id, shopId: shop.id, role: "CLIENT" }, include: { user: true } });
  if (!role || role.user.anonymizedAt) notFound();
  const [appts, notes, profile] = await Promise.all([
    prisma.appointment.findMany({ where: { clientUserId: id, shopId: shop.id }, orderBy: { startsAt: "desc" }, include: { barber: true, service: true, station: true }, take: 50 }),
    prisma.clientNote.findMany({ where: { clientUserId: id, shopId: shop.id }, orderBy: { createdAt: "desc" } }),
    prisma.clientProfile.findUnique({ where: { userId_shopId: { userId: id, shopId: shop.id } } }),
  ]);
  const done = appts.filter((a) => a.status === "COMPLETED");
  const services = new Map<string, number>();
  done.forEach((a) => services.set(a.service.name, (services.get(a.service.name) ?? 0) + 1));
  const u = role.user;
  return (
    <>
      <PageHeader eyebrow="Cliente" title={u.name} description={`${u.email} · ${u.phone || "sem telefone"} · cliente desde ${formatDateTime(role.createdAt, shop.timezone)}`} />
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Concluídos" value={done.length} />
        <StatCard label="Total gasto" value={formatMoney(done.reduce((s, a) => s + a.priceCents, 0))} tone="copper" />
        <StatCard label="Cancelados" value={appts.filter((a) => a.status === "CANCELLED").length} tone="neutral" />
        <StatCard label="Faltas" value={appts.filter((a) => a.status === "NO_SHOW").length} tone="neutral" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {appts.map((a) => <AppointmentCard key={a.id} a={a} tz={shop.timezone} />)}
          {appts.length === 0 && <p className="text-sm text-smoke">Sem agendamentos.</p>}
        </div>
        <div className="space-y-6">
          <Card>
            <CardTitle>Serviços contratados</CardTitle>
            <ul className="space-y-1 text-sm text-mist">{[...services].map(([n, c]) => <li key={n} className="flex justify-between"><span>{n}</span><span className="text-cream">{c}×</span></li>)}{services.size === 0 && <li className="text-smoke">—</li>}</ul>
          </Card>
          <Card>
            <CardTitle>Preferências do cliente</CardTitle>
            <p className="text-sm text-mist">{profile?.preferences || "Não informadas."}</p>
            <p className="mt-1 text-xs text-smoke">Compartilhar com profissionais: {profile?.sharePreferences ? "sim" : "não"} · WhatsApp: {u.notifyWhatsapp ? "autorizado" : "não autorizado"}</p>
          </Card>
          <Card>
            <CardTitle>Observações internas</CardTitle>
            <ClientNoteForm clientUserId={id} />
            <ul className="mt-4 space-y-2">
              {notes.map((n) => <li key={n.id} className="rounded-lg border border-line/60 p-2 text-sm text-mist">{n.body}<span className="mt-1 block text-[11px] text-smoke">{formatDateTime(n.createdAt, shop.timezone)}</span></li>)}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
