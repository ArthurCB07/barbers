import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireShop } from "@/server/shop";
import { getPublishedScene } from "@/server/services/scene";
import { getViewer } from "@/server/viewer";
import { BarbershopExperience } from "@/features/barbershop-3d/BarbershopExperience";
import { Brand } from "@/components/layout/Brand";
import { todayIn } from "@/lib/time";
import { ROLE_HOME } from "@/types/domain";

export const dynamic = "force-dynamic";
export const metadata = { title: "Barbearia 3D" };

export default async function BarbeariaPage({ searchParams }: { searchParams: Promise<{ modo?: string; estacao?: string }> }) {
  const sp = await searchParams;
  const shop = await requireShop();
  const [data, { viewer, session }] = await Promise.all([getPublishedScene(shop.id), getViewer("/barbearia")]);
  const header = (
    <div className="glass flex items-center gap-3 rounded-2xl py-1.5 pl-2 pr-3">
      <Brand name={shop.name} compact />
      <div className="hidden sm:block">
        <p className="font-display text-lg leading-none">{shop.name}</p>
        <p className="text-[11px] text-smoke">{shop.tagline}</p>
      </div>
      <Link href={session ? ROLE_HOME[session.activeRole] : "/"} className="ml-1 inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1 text-xs text-mist hover:bg-white/5 hover:text-cream">
        <ArrowLeft className="h-3.5 w-3.5" /> {session ? "Meu painel" : "Início"}
      </Link>
    </div>
  );
  return (
    <main id="conteudo">
      <h1 className="sr-only">Barbearia virtual {shop.name}</h1>
      <BarbershopExperience
        initialData={data}
        viewer={viewer}
        today={todayIn(shop.timezone)}
        maxAdvanceDays={shop.maxAdvanceDays}
        initialStationId={sp.estacao ?? null}
        force2D={sp.modo === "2d"}
        headerSlot={header}
      />
    </main>
  );
}
