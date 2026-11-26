"use client";

/**
 * Experiência da barbearia virtual: cena 3D + controles de câmera + seleção
 * de estações + painel do profissional com agendamento. Tem fallback 2D
 * completo (sem WebGL, dispositivo fraco, falha do contexto ou escolha).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Box, ChevronDown, Compass, Eye, Grid2x2, LayoutGrid, Map as MapIcon, MousePointerClick, Settings2, CalendarDays, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, Button } from "@/components/ui/primitives";
import { Toaster } from "@/components/ui/client";
import { SceneErrorBoundary } from "@/components/3d/SceneErrorBoundary";
import { detectWebGL, prefersReducedMotion } from "@/components/3d/webgl";
import type { CameraView } from "@/components/3d/CameraRig";
import type { Quality } from "@/components/3d/BarbershopScene";
import { OVERVIEW_VIEW, TOP_VIEW, TOUR_POINTS, chairWorldPosition } from "./layout";
import { BarberPanel, type ViewerInfo } from "./BarberPanel";
import type { SceneData, SceneStation } from "./types";
import { STATION_STATE_LABEL } from "@/types/domain";
import { addDays, formatLongDate } from "@/lib/time";

const BarbershopScene = dynamic(() => import("@/components/3d/BarbershopScene"), { ssr: false, loading: () => null });

const STATE_DOT: Record<string, string> = { AVAILABLE: "bg-success", FULL: "bg-warning", UNAVAILABLE: "bg-copper", INACTIVE: "bg-smoke", VACANT: "bg-smoke" };
const STATE_SHORT: Record<string, string> = { AVAILABLE: "Horários livres", FULL: "Lotado nesta data", UNAVAILABLE: "Indisponível", INACTIVE: "Estação inativa", VACANT: "Em breve" };

const QUALITY_KEY = "bv-quality";
function readSavedQuality(): Quality | null {
  try {
    const v = window.localStorage.getItem(QUALITY_KEY);
    return v === "high" || v === "medium" || v === "low" ? v : null;
  } catch {
    return null;
  }
}
function saveQuality(q: Quality) {
  try {
    window.localStorage.setItem(QUALITY_KEY, q);
  } catch {
    /* armazenamento indisponível: vale só nesta visita */
  }
}

/** Enquadra a cadeira; o deslocamento por causa do painel é feito pela cena (ViewShift) */
export function stationView(s: SceneStation, nonce: number): CameraView {
  const [cx, , cz] = chairWorldPosition(s.x, s.z, s.rotationY);
  const narrow = typeof window !== "undefined" && window.innerWidth < 1024;
  const away = narrow ? 4.4 : 3.3;
  const side = narrow ? 0.8 : 1.4;
  const px = cx + Math.sin(s.rotationY) * away + Math.cos(s.rotationY) * side;
  const pz = cz + Math.cos(s.rotationY) * away - Math.sin(s.rotationY) * side;
  return { nonce, position: [px, 2.1, pz], target: [cx - Math.sin(s.rotationY) * 0.3, 1.05, cz - Math.cos(s.rotationY) * 0.3] };
}

export interface ExperienceProps {
  initialData: SceneData;
  viewer: ViewerInfo;
  today: string;
  maxAdvanceDays: number;
  initialStationId?: string | null;
  force2D?: boolean;
  /** "explore" (cliente) | "focus" (meu espaço do barbeiro) | "preview" (editor) */
  variant?: "explore" | "focus" | "preview";
  embedded?: boolean;
  showPanel?: boolean;
  headerSlot?: React.ReactNode;
}

export function BarbershopExperience(props: ExperienceProps) {
  const { viewer, today, maxAdvanceDays, variant = "explore", embedded = false } = props;
  const [data, setData] = useState<SceneData>(props.initialData);
  const [date, setDate] = useState(props.initialData.date);
  const [webgl, setWebgl] = useState<{ supported: boolean; lowPower: boolean } | null>(null);
  const [mode2D, setMode2D] = useState(!!props.force2D);
  const [quality, setQuality] = useState<Quality>("high");
  const [ready, setReady] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(props.initialStationId ?? null);
  const [menu, setMenu] = useState<null | "tour" | "quality">(null);
  const [interacted, setInteracted] = useState(false);
  const nonce = useRef(1);
  const labelRefs = useRef(new Map<string, HTMLElement>());
  const reduced = useMemo(() => prefersReducedMotion(), []);

  const initialView = useMemo<CameraView>(() => {
    const st = props.initialData.stations.find((s) => s.id === props.initialStationId);
    return st ? stationView(st, 0) : { nonce: 0, ...OVERVIEW_VIEW };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [view, setView] = useState<CameraView>(initialView);
  const go = useCallback((v: Omit<CameraView, "nonce">) => setView({ ...v, nonce: ++nonce.current }), []);

  useEffect(() => setData(props.initialData), [props.initialData]);

  // Link direto para uma estação (?estacao=): ajusta o enquadramento no aparelho
  useEffect(() => {
    const st = props.initialData.stations.find((s) => s.id === props.initialStationId);
    if (st) go(stationView(st, 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const w = detectWebGL();
    setWebgl(w);
    if (!w.supported) setMode2D(true);
    setQuality(readSavedQuality() ?? w.quality);
  }, []);

  // Estados das estações para a data escolhida (consulta real no servidor)
  useEffect(() => {
    if (variant === "preview" || date === props.initialData.date) return;
    let alive = true;
    fetch(`/api/scene?date=${date}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j: SceneData) => alive && j.stations && setData(j))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [date, variant, props.initialData.date]);

  const visibleStations = data.stations.filter((s) => !s.deleted);
  const selectedStation = visibleStations.find((s) => s.id === selected) ?? null;

  const select = useCallback(
    (id: string) => {
      setSelected(id);
      setMenu(null);
      setInteracted(true);
      const st = data.stations.find((s) => s.id === id);
      if (st) go(stationView(st, 0));
    },
    [data.stations, go],
  );

  const closePanel = useCallback(() => {
    setSelected(null);
    go(OVERVIEW_VIEW);
  }, [go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input, textarea, select, dialog")) return;
      if (e.key === "Escape") {
        if (menu) setMenu(null);
        else if (selected) closePanel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu, selected, closePanel]);

  const dropQuality = useCallback(() => setQuality((q) => (q === "high" ? "medium" : "low")), []);
  const showPanel = props.showPanel !== false && variant !== "preview";
  const onSelectStation = variant === "preview" ? () => {} : select;

  // ─── Modo 2D ──────────────────────────────────────────────────────────────
  if (mode2D) {
    return (
      <div className={cn("relative", embedded ? "h-full" : "min-h-dvh")}>
        {!embedded && <Toaster />}
        <div className={cn("mx-auto max-w-6xl px-4 sm:px-6", embedded ? "py-6" : "py-6 sm:py-10")}>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              {props.headerSlot && <div className="mb-5">{props.headerSlot}</div>}
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold">Agendamento</p>
              <h1 className="mt-1 font-display text-4xl font-semibold">Escolha seu profissional</h1>
              <p className="mt-1 text-sm text-smoke">Veja serviços, preços e os horários realmente livres.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DatePill date={date} today={today} max={maxAdvanceDays} onChange={setDate} />
              {webgl?.supported && (
                <Button variant="outline" onClick={() => setMode2D(false)}>
                  <Box className="h-4 w-4" /> Ver em 3D
                </Button>
              )}
            </div>
          </div>
          {webgl && !webgl.supported && (
            <p className="mb-5 rounded-xl border border-info/30 bg-info/5 p-3 text-sm text-info">Seu navegador não suporta gráficos 3D (WebGL). Todas as funções de agendamento continuam disponíveis aqui.</p>
          )}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px]">
            <ul className="grid min-w-0 grid-cols-1 content-start gap-3 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2" aria-label="Profissionais">
              {visibleStations.map((s) => (
                <li key={s.id} className="min-w-0">
                  <StationCard s={s} active={selected === s.id} onClick={() => setSelected(s.id)} />
                </li>
              ))}
            </ul>
            <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
              {selectedStation ? (
                <div className="glass flex max-h-[85dvh] flex-col overflow-hidden rounded-3xl lg:max-h-[calc(100dvh-8rem)]">
                  <BarberPanel station={selectedStation} viewer={viewer} today={today} maxAdvanceDays={maxAdvanceDays} onClose={() => setSelected(null)} />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line px-6 py-14 text-center">
                  <MousePointerClick className="h-7 w-7 text-gold/70" />
                  <p className="text-sm text-mist">Selecione um profissional para ver serviços e horários.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Modo 3D ──────────────────────────────────────────────────────────────
  return (
    <div className={cn("relative isolate overflow-hidden bg-ink", embedded ? "h-full w-full" : "h-dvh w-full")} onPointerDown={() => setInteracted(true)}>
      {!embedded && <Toaster />}
      <div className="absolute inset-0">
        {webgl && (
          <SceneErrorBoundary fallback={<SceneFailure onUse2D={() => setMode2D(true)} />} onError={() => setMode2D(true)}>
            <BarbershopScene
              data={data}
              view={view}
              quality={quality}
              onQualityDrop={dropQuality}
              hoveredId={hovered}
              selectedId={selected}
              onHover={setHovered}
              onSelect={onSelectStation}
              interactive
              reducedMotion={reduced}
              labelRefs={labelRefs}
              panelOpen={showPanel && !!selectedStation}
              onReady={() => setReady(true)}
            />
          </SceneErrorBoundary>
        )}
      </div>

      {/* Rótulos sobre as cadeiras (posicionados pela cena a cada quadro) */}
      <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden={variant === "preview"}>
        {visibleStations.map((s) => {
          const active = hovered === s.id || selected === s.id;
          return (
            <button
              key={s.id}
              ref={(el) => {
                if (el) labelRefs.current.set(s.id, el);
                else labelRefs.current.delete(s.id);
              }}
              tabIndex={-1}
              onClick={() => onSelectStation(s.id)}
              onMouseEnter={() => setHovered(s.id)}
              onMouseLeave={() => setHovered(null)}
              className={cn(
                "pointer-events-auto absolute left-0 top-0 flex items-center gap-2 whitespace-nowrap rounded-full border py-1 pl-1 pr-3 text-left shadow-[0_10px_30px_-10px_rgba(0,0,0,0.8)] backdrop-blur-md transition-[background,border,opacity] duration-200 will-change-transform",
                active ? "border-gold/70 bg-black/85" : "border-white/10 bg-black/55 hover:bg-black/75",
              )}
              style={{ opacity: 0 }}
            >
              <Avatar name={s.barber?.displayName ?? s.name} src={s.barber?.photoUrl} size={28} />
              <span className="leading-tight">
                <span className="block text-[12px] font-medium text-cream">{s.barber?.displayName ?? s.name}</span>
                <span className="flex items-center gap-1 text-[10px] text-mist">
                  <span className={cn("h-1.5 w-1.5 rounded-full", STATE_DOT[s.state])} />
                  {active && s.barber && s.state === "AVAILABLE" && variant !== "preview" ? "Clique para agendar" : STATE_SHORT[s.state]}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Carregamento */}
      <div className={cn("pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center bg-ink transition-opacity duration-700", ready ? "opacity-0" : "opacity-100")} aria-hidden={ready} role="status">
        <div className="relative h-14 w-14">
          <div className="absolute inset-0 rounded-full border border-gold/15" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-gold" />
        </div>
        <p className="mt-5 font-display text-2xl text-gold-soft">Abrindo as portas…</p>
        <p className="mt-1 text-xs text-smoke">Preparando ambiente, iluminação e estações</p>
      </div>

      {/* Topo */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 bg-gradient-to-b from-black/50 to-transparent p-3 sm:p-4">
        <div className="pointer-events-auto">{props.headerSlot}</div>
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="glass flex items-center rounded-2xl p-1" role="toolbar" aria-label="Câmera">
            <ToolButton label="Visão geral" icon={<Eye className="h-4 w-4" />} onClick={() => { setMenu(null); setSelected(null); go(OVERVIEW_VIEW); }} />
            <ToolButton label="Planta" icon={<MapIcon className="h-4 w-4" />} onClick={() => { setMenu(null); go(TOP_VIEW); }} />
            <div className="relative">
              <ToolButton label="Ambientes" icon={<Compass className="h-4 w-4" />} trailing={<ChevronDown className="h-3 w-3" />} active={menu === "tour"} onClick={() => setMenu(menu === "tour" ? null : "tour")} />
              {menu === "tour" && (
                <Menu>
                  {TOUR_POINTS.map((p) => (
                    <MenuItem key={p.key} onClick={() => { setMenu(null); go({ position: p.position, target: p.target }); }}>
                      {p.label}
                    </MenuItem>
                  ))}
                </Menu>
              )}
            </div>
            <div className="relative">
              <ToolButton label="Qualidade" icon={<Settings2 className="h-4 w-4" />} compact active={menu === "quality"} onClick={() => setMenu(menu === "quality" ? null : "quality")} />
              {menu === "quality" && (
                <Menu>
                  <p className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-smoke">Qualidade gráfica</p>
                  {(["high", "medium", "low"] as Quality[]).map((q) => (
                    <MenuItem key={q} onClick={() => { setQuality(q); saveQuality(q); setMenu(null); }}>
                      <span className="flex-1">{q === "high" ? "Alta" : q === "medium" ? "Equilibrada" : "Leve (bateria)"}</span>
                      {quality === q && <Check className="h-3.5 w-3.5 text-gold" />}
                    </MenuItem>
                  ))}
                </Menu>
              )}
            </div>
            {variant === "explore" && <ToolButton label="2D" icon={<LayoutGrid className="h-4 w-4" />} onClick={() => setMode2D(true)} />}
          </div>
        </div>
      </div>

      {/* Dica */}
      {ready && variant === "explore" && !interacted && !selected && (
        <div className="pointer-events-none absolute left-1/2 top-20 z-10 hidden -translate-x-1/2 animate-fade-up sm:block">
          <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs text-mist">
            <MousePointerClick className="h-3.5 w-3.5 text-gold" /> Arraste para girar · role para aproximar · clique em uma cadeira
          </span>
        </div>
      )}

      {/* Dock inferior: data + profissionais */}
      {variant === "explore" && (
        <div className={cn("pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/60 to-transparent p-3 pt-10 sm:p-4 sm:pt-12", selectedStation && showPanel && "max-lg:hidden lg:right-[456px]")}>
          <div className="pointer-events-auto mx-auto flex w-full max-w-4xl flex-col gap-2 sm:w-fit sm:max-w-full sm:flex-row sm:items-stretch">
            <div className="glass flex shrink-0 items-center rounded-2xl px-3 py-2">
              <DatePill date={date} today={today} max={maxAdvanceDays} onChange={setDate} bare />
            </div>
            <div className="glass flex min-w-0 gap-1.5 overflow-x-auto rounded-2xl p-1.5" role="list" aria-label="Profissionais da barbearia">
              {visibleStations.map((s) => (
                <button
                  key={s.id}
                  role="listitem"
                  onClick={() => select(s.id)}
                  onMouseEnter={() => setHovered(s.id)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(s.id)}
                  onBlur={() => setHovered(null)}
                  aria-label={`${s.name}: ${s.barber?.displayName ?? "sem profissional"} — ${STATION_STATE_LABEL[s.state]}`}
                  className={cn("flex min-w-[180px] items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition", selected === s.id ? "bg-gold/15 ring-1 ring-gold/60" : "hover:bg-white/5")}
                >
                  <Avatar name={s.barber?.displayName ?? s.name} src={s.barber?.photoUrl} size={36} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-cream">{s.barber?.displayName ?? s.name}</span>
                    <span className="flex items-center gap-1.5 text-[11px] text-smoke">
                      <span className={cn("h-1.5 w-1.5 rounded-full", STATE_DOT[s.state])} /> {STATE_SHORT[s.state]}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Painel do profissional */}
      {showPanel && selectedStation && (
        <aside
          key={selectedStation.id}
          className="glass absolute z-30 flex flex-col overflow-hidden animate-fade-up max-lg:inset-x-0 max-lg:bottom-0 max-lg:h-[66dvh] max-lg:rounded-t-3xl lg:bottom-4 lg:right-4 lg:top-[72px] lg:w-[440px] lg:rounded-3xl"
          aria-label={`Profissional: ${selectedStation.barber?.displayName ?? selectedStation.name}`}
        >
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/20 lg:hidden" />
          <BarberPanel station={selectedStation} viewer={viewer} today={today} maxAdvanceDays={maxAdvanceDays} onClose={closePanel} />
        </aside>
      )}
    </div>
  );
}

function ToolButton({ label, onClick, icon, active, trailing, compact }: { label: string; onClick: () => void; icon: React.ReactNode; active?: boolean; trailing?: React.ReactNode; compact?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn("flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium transition", active ? "bg-gold/20 text-gold-soft" : "text-mist hover:bg-white/5 hover:text-cream")}
    >
      {icon}
      {!compact && <span className="hidden md:inline">{label}</span>}
      {trailing && <span className="hidden md:inline">{trailing}</span>}
    </button>
  );
}

function Menu({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass absolute right-0 top-11 z-50 w-52 rounded-2xl p-1.5 shadow-2xl animate-fade-up" role="menu">
      {children}
    </div>
  );
}

function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button role="menuitem" onClick={onClick} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-mist hover:bg-white/5 hover:text-cream">
      {children}
    </button>
  );
}

function StationCard({ s, active, onClick }: { s: SceneStation; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn("group flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition", active ? "border-gold/60 bg-gold/10" : "border-line bg-graphite/60 hover:border-gold/30 hover:bg-graphite")}
    >
      <Avatar name={s.barber?.displayName ?? s.name} src={s.barber?.photoUrl} size={56} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-xl text-cream">{s.barber?.displayName ?? s.name}</span>
        <span className="block truncate text-xs text-smoke">{s.barber?.specialties.slice(0, 3).join(" · ") || s.name}</span>
        <span className="mt-1.5 flex items-center gap-1.5 whitespace-nowrap text-xs text-mist">
          <span className={cn("h-2 w-2 shrink-0 rounded-full", STATE_DOT[s.state])} /> <span className="truncate">{STATE_SHORT[s.state]}</span>
        </span>
      </span>
      <Grid2x2 className="h-4 w-4 shrink-0 text-smoke opacity-0 transition group-hover:opacity-100" aria-hidden />
    </button>
  );
}

function DatePill({ date, today, max, onChange, bare }: { date: string; today: string; max: number; onChange: (d: string) => void; bare?: boolean }) {
  return (
    <label className={cn("flex items-center gap-2 text-xs text-mist", !bare && "glass rounded-xl px-3 py-2")}>
      <CalendarDays className="h-4 w-4 text-gold" />
      <span className="hidden sm:inline">{date === today ? "Hoje" : formatLongDate(date)}</span>
      <input
        type="date"
        value={date}
        min={today}
        max={addDays(today, max)}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="w-[118px] rounded-lg border border-line bg-coal/80 px-2 py-1 text-cream [color-scheme:dark]"
        aria-label="Data para ver disponibilidade"
      />
    </label>
  );
}

function SceneFailure({ onUse2D }: { onUse2D: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="font-display text-2xl">Não foi possível carregar o ambiente 3D.</p>
      <p className="text-sm text-smoke">Você pode continuar normalmente no modo simplificado.</p>
      <Button onClick={onUse2D}>
        <LayoutGrid className="h-4 w-4" /> Usar modo 2D
      </Button>
    </div>
  );
}
