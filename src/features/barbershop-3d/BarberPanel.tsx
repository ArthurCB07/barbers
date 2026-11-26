"use client";

/** Cartão profissional + serviços + agendamento (usado no 3D e no modo 2D) */
import { Heart, X } from "lucide-react";
import { Avatar } from "@/components/ui/primitives";
import { useAction } from "@/components/ui/client";
import { toggleFavoriteAction } from "@/server/actions/app";
import { BookingFlow } from "@/features/appointments/BookingFlow";
import { STATION_STATE_LABEL } from "@/types/domain";
import { cn } from "@/lib/utils";
import type { SceneStation } from "./types";

export interface ViewerInfo {
  isLoggedIn: boolean;
  isClient: boolean;
  ownBarberProfileId: string | null;
  favoriteIds: string[];
  loginHref: string;
}

const STATE_STYLE: Record<string, string> = {
  AVAILABLE: "bg-success/15 text-success",
  FULL: "bg-warning/15 text-warning",
  UNAVAILABLE: "bg-copper/15 text-copper",
  INACTIVE: "bg-white/5 text-smoke",
  VACANT: "bg-white/5 text-smoke",
};

export function BarberPanel({ station, viewer, today, maxAdvanceDays, onClose }: { station: SceneStation; viewer: ViewerInfo; today: string; maxAdvanceDays: number; onClose: () => void }) {
  const barber = station.barber;
  const fav = useAction(toggleFavoriteAction);
  const isFav = barber ? viewer.favoriteIds.includes(barber.id) : false;
  const isSelf = barber && viewer.ownBarberProfileId === barber.id;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Cabeçalho */}
      <div className="relative shrink-0 overflow-hidden border-b border-white/5 px-5 py-3.5 lg:py-4">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-gold/15 blur-3xl" />
        <div className="relative flex items-start gap-4">
          <div className="rounded-full bg-gradient-to-br from-gold-soft via-gold to-copper p-[2px]">
            <Avatar name={barber?.displayName ?? station.name} src={barber?.photoUrl} size={52} className="border-0 ring-2 ring-ink" />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gold">{station.name}</p>
            <h2 className="truncate font-display text-2xl font-semibold leading-tight text-cream">{barber?.displayName ?? "Estação disponível"}</h2>
            <span className={cn("mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium", STATE_STYLE[station.state])}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" /> {STATION_STATE_LABEL[station.state]}
            </span>
          </div>
          <div className="flex shrink-0 items-center">
            {barber && viewer.isLoggedIn && viewer.isClient && !isSelf && (
              <button
                onClick={() => fav.run(barber.id)}
                disabled={fav.pending}
                aria-pressed={isFav}
                aria-label={isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                className="rounded-full p-2 text-smoke transition hover:bg-white/5 hover:text-gold"
              >
                <Heart className={cn("h-5 w-5", isFav && "fill-gold text-gold")} />
              </button>
            )}
            <button onClick={onClose} aria-label="Fechar painel" className="rounded-full p-2 text-smoke transition hover:bg-white/5 hover:text-cream">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Corpo */}
      {!barber ? (
        <p className="p-5 text-sm text-smoke">{station.state === "INACTIVE" ? "Esta estação está temporariamente inativa." : "Em breve um novo profissional ocupará esta cadeira."}</p>
      ) : (
        <BookingFlow
          intro={
            (barber.bio || barber.specialties.length > 0) && (
              <div className="space-y-3">
                {barber.bio && <p className="text-sm leading-relaxed text-mist">{barber.bio}</p>}
                {barber.specialties.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {barber.specialties.map((s) => (
                      <span key={s} className="rounded-full border border-gold/25 bg-gold/5 px-2.5 py-0.5 text-[11px] text-gold-soft">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          }
          barber={{ id: barber.id, displayName: barber.displayName }}
          services={barber.services ?? []}
          today={today}
          maxAdvanceDays={maxAdvanceDays}
          isLoggedIn={viewer.isLoggedIn}
          canBook={viewer.isClient && !isSelf}
          cannotBookReason={isSelf ? "Você não pode agendar consigo mesmo. Escolha outro profissional." : "Sua conta não tem perfil de cliente nesta barbearia."}
          loginHref={viewer.loginHref}
        />
      )}
    </div>
  );
}
