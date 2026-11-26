import Link from "next/link";
import { ArrowRight, Box, CalendarPlus, Sparkles } from "lucide-react";
import { requireRole } from "@/server/auth/session";
import { requireShop } from "@/server/shop";
import { prisma } from "@/server/db";
import { Card, CardTitle, EmptyState, LinkButton, PageHeader, Avatar } from "@/components/ui/primitives";
import { AppointmentCard } from "@/features/appointments/AppointmentCard";
import { AppointmentActions } from "@/features/appointments/AppointmentActions";
import { toActionable } from "@/features/appointments/mapping";
import { formatDuration, formatMoney, safeJson } from "@/lib/utils";
import { todayIn } from "@/lib/time";

export default async function ClientHome() {
  const shop = await requireShop();
  const s = await requireRole("CLIENT");
  const [next, services, barbers] = await Promise.all([
    prisma.appointment.findFirst({
      where: { clientUserId: s.user.id, shopId: shop.id, status: { in: ["PENDING", "CONFIRMED"] }, startsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
      include: { barber: true, service: true, station: true },
    }),
    prisma.service.findMany({ where: { shopId: shop.id, active: true }, orderBy: { sortOrder: "asc" }, include: { category: true } }),
    prisma.barberProfile.findMany({ where: { shopId: shop.id, status: "APPROVED", userId: { not: null } }, include: { station: true } }),
  ]);
  const today = todayIn(shop.timezone);
  return (
    <>
      <PageHeader eyebrow="Área do cliente" title={`Olá, ${s.user.name.split(" ")[0]}`} description="Seu próximo corte começa aqui." actions={<LinkButton href="/cliente/agendar"><CalendarPlus className="h-4 w-4" /> Novo agendamento</LinkButton>} />

      <Link href="/barbearia" className="group relative mb-6 block overflow-hidden rounded-3xl border border-gold/25 bg-[radial-gradient(ellipse_at_80%_0%,rgba(200,161,101,0.25),transparent_60%),linear-gradient(120deg,#1b1a18,#121110)] p-6 sm:p-8">
        <div className="relative z-10 max-w-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Experiência 3D</p>
          <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Entre na barbearia virtual</h2>
          <p className="mt-2 text-sm text-mist">Passeie pelo salão, clique na cadeira do seu barbeiro e reserve em segundos.</p>
          <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-gold-soft">
            <Box className="h-4 w-4" /> Explorar agora <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </span>
        </div>
        <Box className="absolute -bottom-8 -right-6 h-48 w-48 text-gold/10 transition group-hover:rotate-12" strokeWidth={0.8} />
      </Link>

      <section className="mb-8">
        <CardTitle>Próximo atendimento</CardTitle>
        {next ? (
          <AppointmentCard a={next} tz={shop.timezone} actions={<AppointmentActions a={toActionable(next, { role: "CLIENT", policyHours: shop.cancelPolicyHours })} today={today} maxAdvanceDays={shop.maxAdvanceDays} />} />
        ) : (
          <EmptyState icon={<CalendarPlus className="h-8 w-8" />} title="Nenhum horário marcado" description="Escolha um profissional e um horário livre." action={<LinkButton href="/cliente/agendar" variant="outline">Agendar agora</LinkButton>} />
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardTitle>Serviços e preços</CardTitle>
          <ul className="divide-y divide-line/60">
            {services.map((sv) => (
              <li key={sv.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-sm font-medium text-cream">{sv.name}</p>
                  <p className="text-xs text-smoke">{sv.category?.name} · {formatDuration(sv.durationMin)} · a partir de</p>
                </div>
                <span className="font-display text-lg text-gold-soft">{formatMoney(sv.priceCents)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-smoke">Preços podem variar por profissional. O valor exato aparece no agendamento.</p>
        </Card>
        <Card>
          <CardTitle>Nossa equipe</CardTitle>
          <ul className="space-y-3">
            {barbers.map((b) => (
              <li key={b.id}>
                <Link href={b.station ? `/barbearia?estacao=${b.station.id}` : "/cliente/agendar"} className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-white/5">
                  <Avatar name={b.displayName} src={b.photoUrl} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-cream">{b.displayName}</p>
                    <p className="flex min-w-0 items-center gap-1 text-xs text-smoke">
                      <Sparkles className="h-3 w-3 shrink-0 text-gold" /> <span className="truncate">{safeJson<string[]>(b.specialties, []).join(" · ")}</span>
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
