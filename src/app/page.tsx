import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarCheck, Scissors, Box, MapPin, Clock } from "lucide-react";
import { getShop } from "@/server/shop";
import { getSession } from "@/server/auth/session";
import { getPublishedScene } from "@/server/services/scene";
import { HeroBackdrop } from "@/features/barbershop-3d/HeroBackdrop";
import { Brand } from "@/components/layout/Brand";
import { buttonClass } from "@/components/ui/primitives";
import { ROLE_HOME, ROLE_LABEL } from "@/types/domain";

export const dynamic = "force-dynamic";

export default async function Home() {
  const shop = await getShop();
  if (!shop) redirect("/setup");
  const [session, scene] = await Promise.all([getSession(), getPublishedScene(shop.id)]);
  const team = scene.stations.filter((s) => s.barber).length;

  return (
    <main id="conteudo" className="relative min-h-dvh overflow-hidden">
      <HeroBackdrop data={scene} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/60 via-transparent to-ink/90" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-ink/95 via-ink/55 to-transparent lg:via-ink/35" />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-7xl flex-col px-5 py-5 sm:px-8">
        <header className="flex items-center justify-between">
          <Brand name={shop.name} />
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/barbearia" className="hidden rounded-lg px-3 py-2 text-mist hover:text-cream sm:inline-flex">
              Explorar em 3D
            </Link>
            {session ? (
              <Link href={ROLE_HOME[session.activeRole]} className={buttonClass("outline", "sm")}>
                Continuar como {ROLE_LABEL[session.activeRole]}
              </Link>
            ) : (
              <Link href="/entrar" className="rounded-lg px-3 py-2 text-mist underline-offset-4 hover:text-cream hover:underline">
                Já tenho conta · Entrar
              </Link>
            )}
          </nav>
        </header>

        <section className="flex flex-1 flex-col justify-center py-8">
          <p className="animate-fade-up text-xs font-semibold uppercase tracking-[0.35em] text-gold">{shop.tagline || "Barbearia premium"}</p>
          <h1 className="mt-4 max-w-3xl animate-fade-up font-display text-5xl font-semibold leading-[1.02] sm:text-7xl" style={{ animationDelay: "80ms" }}>
            Entre na <span className="text-gradient-gold">{shop.name}</span> antes mesmo de chegar.
          </h1>
          <p className="mt-5 max-w-xl animate-fade-up text-base text-mist sm:text-lg" style={{ animationDelay: "160ms" }}>
            Passeie pela nossa barbearia em 3D, conheça cada cadeira e profissional e reserve seu horário com disponibilidade real.
          </p>

          <div className="mt-8 grid max-w-3xl animate-fade-up gap-4 sm:grid-cols-2" style={{ animationDelay: "240ms" }}>
            <ProfileCard href="/cadastro/cliente" icon={<CalendarCheck className="h-6 w-6" />} title="Sou cliente" text="Agende seu horário e conheça nossa barbearia." cta="Criar conta de cliente" />
            <ProfileCard href="/cadastro/barbeiro" icon={<Scissors className="h-6 w-6 -rotate-45" />} title="Sou barbeiro" text="Gerencie sua agenda ou faça parte da nossa equipe." cta="Cadastro profissional" />
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-mist">
            <Link href="/barbearia" className="inline-flex items-center gap-2 text-gold-soft hover:text-gold">
              <Box className="h-4 w-4" /> Explorar sem cadastro
            </Link>
            <Link href="/entrar" className="underline-offset-4 hover:text-cream hover:underline">
              Já tenho uma conta
            </Link>
          </div>
        </section>

        <footer className="grid gap-3 border-t hairline pt-5 text-xs text-smoke sm:grid-cols-3">
          <p className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-gold" /> {shop.address || "Endereço em breve"} {shop.city && `· ${shop.city}`}
          </p>
          <p className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-gold" /> {team} profissional{team === 1 ? "" : "is"} na equipe · agendamento online 24h
          </p>
          <p className="sm:text-right">
            <Link href="/privacidade" className="hover:text-cream">
              Privacidade e termos (LGPD)
            </Link>
          </p>
        </footer>
      </div>
    </main>
  );
}

function ProfileCard({ href, icon, title, text, cta }: { href: string; icon: React.ReactNode; title: string; text: string; cta: string }) {
  return (
    <Link href={href} className="glass group relative overflow-hidden rounded-3xl p-6 transition duration-300 hover:-translate-y-1 hover:border-gold/50 focus-visible:-translate-y-1">
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gold/10 blur-2xl transition group-hover:bg-gold/20" />
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gold/40 bg-gold/10 text-gold">{icon}</span>
      <h2 className="mt-5 font-display text-3xl font-semibold uppercase tracking-wide">{title}</h2>
      <p className="mt-1.5 text-sm text-mist">{text}</p>
      <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-gold-soft">
        {cta} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
      </span>
    </Link>
  );
}
