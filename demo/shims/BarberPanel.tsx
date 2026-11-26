/** Painel da demonstração: apresenta o profissional e os serviços, sem agendamento */
import { Clock, X } from "lucide-react";
import type { SceneStation } from "@/features/barbershop-3d/types";
import { formatDuration, formatMoney, initials } from "@/lib/utils";

export function BarberPanel({ station, onClose }: { station: SceneStation; onClose: () => void }) {
  const barber = station.barber!;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-4 border-b border-white/5 px-5 py-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gradient-to-br from-wood to-graphite font-display text-xl text-gold-soft">
          {initials(barber.displayName)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gold">{station.name}</p>
          <h2 className="truncate font-display text-2xl font-semibold text-cream">{barber.displayName}</h2>
        </div>
        <button onClick={onClose} aria-label="Fechar painel" className="rounded-full p-2 text-smoke hover:bg-white/5 hover:text-cream">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
        <p className="text-sm leading-relaxed text-mist">{barber.bio}</p>
        <div className="flex flex-wrap gap-1.5">
          {barber.specialties.map((s) => (
            <span key={s} className="rounded-full border border-gold/25 bg-gold/5 px-2.5 py-0.5 text-[11px] text-gold-soft">
              {s}
            </span>
          ))}
        </div>
        <h3 className="pt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-smoke">Serviços</h3>
        <ul className="space-y-1.5">
          {(barber.services ?? []).map((s) => (
            <li key={s.id} className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-cream">{s.name}</span>
                <span className="mt-0.5 flex items-center gap-1 text-xs text-smoke">
                  <Clock className="h-3 w-3" /> {formatDuration(s.durationMin)}
                </span>
              </span>
              <span className="font-display text-lg text-gold-soft">{formatMoney(s.priceCents)}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="shrink-0 border-t border-white/[0.06] bg-black/30 px-5 py-4 text-center text-xs text-smoke">
        Esta é uma demonstração: o agendamento funciona apenas na versão completa do sistema.
      </p>
    </div>
  );
}
