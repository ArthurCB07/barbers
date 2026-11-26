import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowLeft, ArrowRight, Box, Scissors } from "lucide-react";
import { BarbershopExperience } from "@/features/barbershop-3d/BarbershopExperience";
import { formatDuration, formatMoney } from "@/lib/utils";
import { SCENE, SERVICES } from "./data";
import "./styles.css";

const viewer = { isLoggedIn: false, isClient: false, ownBarberProfileId: null, favoriteIds: [], loginHref: "#" };

function useHash() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
}

function Home() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_75%_20%,rgba(200,161,101,0.18),transparent_60%),radial-gradient(ellipse_at_10%_90%,rgba(184,115,51,0.12),transparent_55%)]" />
      <div className="relative mx-auto flex max-w-6xl flex-col px-5 py-6 sm:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-gold/40 bg-gradient-to-br from-wood/70 to-coal text-gold">
              <Scissors className="h-4 w-4 -rotate-45" />
            </span>
            <span className="font-display text-xl font-semibold tracking-wide text-cream">Barberverse</span>
          </span>
          <span className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs text-gold-soft">Demonstração · dados de exemplo</span>
        </header>
        <section className="py-14 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gold">Barbearia premium</p>
          <h1 className="mt-4 max-w-3xl font-display text-5xl font-semibold leading-[1.05] sm:text-7xl">
            Entre na <span className="text-gradient-gold">Barberverse</span> antes mesmo de chegar.
          </h1>
          <p className="mt-5 max-w-xl text-mist sm:text-lg">Passeie pela barbearia em 3D e conheça cada cadeira, os profissionais e os serviços.</p>
          <a href="#3d" className="mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-b from-gold-soft to-gold px-6 font-medium text-ink hover:brightness-110">
            <Box className="h-4 w-4" /> Explorar a barbearia 3D <ArrowRight className="h-4 w-4" />
          </a>
        </section>
        <section aria-labelledby="servicos" className="pb-10">
          <h2 id="servicos" className="mb-4 font-display text-3xl font-semibold">Serviços</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s) => (
              <li key={s.id} className="rounded-2xl border border-line bg-graphite/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-cream">{s.name}</p>
                  <span className="font-display text-xl text-gold-soft">{formatMoney(s.priceCents)}</span>
                </div>
                <p className="mt-1 text-xs text-smoke">
                  {formatDuration(s.durationMin)} · {s.description}
                </p>
              </li>
            ))}
          </ul>
        </section>
        <footer className="border-t hairline py-5 text-xs text-smoke">
          Vitrine estática do projeto. Login, agendamentos e painéis fazem parte da versão completa, que precisa de servidor e banco de dados.
        </footer>
      </div>
    </main>
  );
}

function App() {
  if (useHash() !== "#3d") return <Home />;
  return (
    <BarbershopExperience
      demo
      initialData={SCENE}
      viewer={viewer}
      today={SCENE.date}
      maxAdvanceDays={0}
      headerSlot={
        <div className="glass flex items-center gap-3 rounded-2xl px-3 py-2.5">
          <a href="#" className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-mist hover:text-cream">
            <ArrowLeft className="h-3.5 w-3.5" /> Início
          </a>
          <span className="hidden text-[11px] text-gold-soft sm:inline">Demonstração</span>
        </div>
      }
    />
  );
}

// As placas 3D são desenhadas em canvas: espera as fontes antes de montar
const fonts = Promise.all([document.fonts.load('600 40px "Cormorant Garamond"'), document.fonts.load('500 20px "Inter"')]);
Promise.race([fonts, new Promise((resolve) => setTimeout(resolve, 2500))]).finally(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});
