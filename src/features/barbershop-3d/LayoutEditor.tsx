"use client";

/**
 * Editor de layout: estações em pontos seguros, giro limitado, modelo,
 * cor, vínculo de profissional, ativação, remoção e personalização da
 * fachada. Tudo fica em rascunho com prévia 3D ao vivo até "Publicar".
 */
import { useEffect, useState } from "react";
import { Plus, Rocket, Trash2, Undo2 } from "lucide-react";
import { Badge, Button, Card, CardTitle, Checkbox, Field, Input, Notice, Select } from "@/components/ui/primitives";
import { ActionButton, useAction } from "@/components/ui/client";
import { addStationAction, deleteStationAction, discardLayoutAction, publishLayoutAction, updateSceneConfigAction, updateStationAction } from "@/server/actions/app";
import { BarbershopExperience } from "./BarbershopExperience";
import { ROTATION_OFFSETS_DEG, STATION_MODELS, STATION_SPOTS, ROOM, offsetDegFor, spotByKey } from "./layout";
import type { SceneData } from "./types";
import type { ViewerInfo } from "./BarberPanel";
import { cn } from "@/lib/utils";

type Draft = SceneData & { freeSpots: string[]; hasPending: boolean };

export function LayoutEditor({ draft, barbers, viewer, today }: { draft: Draft; barbers: Array<{ id: string; displayName: string; status: string }>; viewer: ViewerInfo; today: string }) {
  const [newName, setNewName] = useState(`Estação ${String(draft.stations.filter((s) => !s.deleted).length + 1).padStart(2, "0")}`);
  const [newModel, setNewModel] = useState("classic");
  const [newSpot, setNewSpot] = useState(draft.freeSpots[0] ?? "");
  const [newBarber, setNewBarber] = useState("");
  const [cfg, setCfg] = useState(draft.config);
  const add = useAction(addStationAction, { onSuccess: () => setNewBarber("") });
  // Após cada inclusão/remoção, reposiciona os padrões no próximo ponto livre
  const freeKey = draft.freeSpots.join(",");
  const aliveCount = draft.stations.filter((s) => !s.deleted).length;
  useEffect(() => {
    setNewSpot((cur) => (draft.freeSpots.includes(cur) ? cur : draft.freeSpots[0] ?? ""));
    setNewName(`Estação ${String(aliveCount + 1).padStart(2, "0")}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freeKey, aliveCount]);
  const upd = useAction(updateStationAction);
  const saveCfg = useAction(updateSceneConfigAction);
  const assigned = new Map(draft.stations.filter((s) => !s.deleted && s.barber).map((s) => [s.barber!.id, s.name]));
  const visible = draft.stations;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="min-w-0 space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          {draft.hasPending ? <Badge tone="warning">Há alterações não publicadas</Badge> : <Badge tone="success">Tudo publicado</Badge>}
          <div className="ml-auto flex gap-2">
            <ActionButton action={discardLayoutAction} variant="ghost" size="md" disabled={!draft.hasPending} confirm="Descartar todas as alterações do rascunho?">
              <Undo2 className="h-4 w-4" /> Descartar
            </ActionButton>
            <ActionButton action={publishLayoutAction} variant="primary" size="md" disabled={!draft.hasPending}>
              <Rocket className="h-4 w-4" /> Publicar alterações
            </ActionButton>
          </div>
        </div>

        <Card>
          <CardTitle>Adicionar estação</CardTitle>
          {draft.freeSpots.length === 0 ? (
            <Notice tone="warning">Não há espaço disponível para uma nova estação. Remova ou mova uma estação existente.</Notice>
          ) : (
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void add.run({ name: newName, model: newModel, spotKey: newSpot || undefined, barberProfileId: newBarber || null }); }}>
              <Field label="Identificação" htmlFor="nn"><Input id="nn" value={newName} onChange={(e) => setNewName(e.target.value)} /></Field>
              <Field label="Modelo de cadeira" htmlFor="nm"><Select id="nm" value={newModel} onChange={(e) => setNewModel(e.target.value)}>{STATION_MODELS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</Select></Field>
              <Field label="Ponto (posição segura)" htmlFor="ns"><Select id="ns" value={newSpot} onChange={(e) => setNewSpot(e.target.value)}>{draft.freeSpots.map((k) => <option key={k} value={k}>{k} — {spotByKey(k)?.label}</option>)}</Select></Field>
              <Field label="Profissional" htmlFor="nb">
                <Select id="nb" value={newBarber} onChange={(e) => setNewBarber(e.target.value)}>
                  <option value="">Sem profissional</option>
                  {barbers.map((b) => <option key={b.id} value={b.id} disabled={assigned.has(b.id)}>{b.displayName}{assigned.has(b.id) ? ` (${assigned.get(b.id)})` : ""}</option>)}
                </Select>
              </Field>
              <Button type="submit" disabled={add.pending} className="sm:col-span-2"><Plus className="h-4 w-4" /> Adicionar ao rascunho</Button>
            </form>
          )}
          <p className="mt-3 text-xs text-smoke">{draft.freeSpots.length} de {STATION_SPOTS.length} pontos livres. Os pontos evitam sobreposição de móveis e mantêm a circulação livre.</p>
        </Card>

        <div className="space-y-3">
          {visible.map((s) => {
            const usedSpots = new Set(draft.stations.filter((x) => x.id !== s.id && !x.deleted).map((x) => x.spotKey));
            return (
              <Card key={s.id} className={cn("p-4", s.deleted && "border-danger/40 opacity-60", s.pending && !s.deleted && "border-warning/40")}>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: s.accentColor }} />
                  <p className="font-medium text-cream">{s.name}</p>
                  {s.isNew && <Badge tone="info">Nova</Badge>}
                  {s.pending && !s.deleted && !s.isNew && <Badge tone="warning">Editada</Badge>}
                  {s.deleted && <Badge tone="danger">Será removida</Badge>}
                  {!s.active && <Badge>Inativa</Badge>}
                  {s.stateDetail && <Badge tone="info">{s.stateDetail}</Badge>}
                  {!s.deleted && (
                    <ActionButton action={() => deleteStationAction(s.id)} variant="ghost" className="ml-auto" confirm="Remover esta estação? Estações com reservas vinculadas não podem ser removidas (desative-as).">
                      <Trash2 className="h-3.5 w-3.5" /> Remover
                    </ActionButton>
                  )}
                </div>
                {!s.deleted && (
                  <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                    <Field label="Identificação" htmlFor={`n-${s.id}`}>
                      <Input id={`n-${s.id}`} defaultValue={s.name} onBlur={(e) => e.target.value !== s.name && upd.run(s.id, { name: e.target.value })} />
                    </Field>
                    <Field label="Profissional" htmlFor={`b-${s.id}`}>
                      <Select id={`b-${s.id}`} value={s.barber?.id ?? ""} onChange={(e) => upd.run(s.id, { barberProfileId: e.target.value || null })}>
                        <option value="">Sem profissional</option>
                        {barbers.map((b) => <option key={b.id} value={b.id} disabled={assigned.has(b.id) && assigned.get(b.id) !== s.name}>{b.displayName}{b.status === "INVITED" ? " (convite pendente)" : ""}</option>)}
                      </Select>
                    </Field>
                    <Field label="Ponto" htmlFor={`s-${s.id}`}>
                      <Select id={`s-${s.id}`} value={s.spotKey} onChange={(e) => upd.run(s.id, { spotKey: e.target.value })}>
                        {STATION_SPOTS.map((p) => <option key={p.key} value={p.key} disabled={usedSpots.has(p.key)}>{p.key} — {p.label}{usedSpots.has(p.key) ? " (ocupado)" : ""}</option>)}
                      </Select>
                    </Field>
                    <Field label="Giro" htmlFor={`r-${s.id}`}>
                      <Select id={`r-${s.id}`} value={offsetDegFor(s.spotKey, s.rotationY)} onChange={(e) => upd.run(s.id, { rotationOffsetDeg: Number(e.target.value) })}>
                        {ROTATION_OFFSETS_DEG.map((d) => <option key={d} value={d}>{d > 0 ? `+${d}°` : `${d}°`}</option>)}
                      </Select>
                    </Field>
                    <Field label="Modelo" htmlFor={`m-${s.id}`}>
                      <Select id={`m-${s.id}`} value={s.model} onChange={(e) => upd.run(s.id, { model: e.target.value })}>
                        {STATION_MODELS.map((m) => <option key={m.key} value={m.key}>{m.key === "classic" ? "Clássica" : "Moderna"}</option>)}
                      </Select>
                    </Field>
                    <Field label="Cor de destaque" htmlFor={`c-${s.id}`}>
                      <Input id={`c-${s.id}`} type="color" className="h-11 p-1" defaultValue={s.accentColor} onBlur={(e) => e.target.value !== s.accentColor && upd.run(s.id, { accentColor: e.target.value })} />
                    </Field>
                    <Checkbox className="sm:col-span-2 2xl:col-span-3" checked={s.active} onChange={(e) => upd.run(s.id, { active: e.target.checked })} label="Estação ativa" description="Estações inativas aparecem apagadas e não recebem agendamentos." />
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <Card>
          <CardTitle>Fachada e ambientação</CardTitle>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void saveCfg.run(cfg); }}>
            <Field label="Texto da placa" htmlFor="sign"><Input id="sign" maxLength={24} value={cfg.signText} onChange={(e) => setCfg({ ...cfg, signText: e.target.value })} /></Field>
            <Field label="Cor de destaque" htmlFor="acc"><Input id="acc" type="color" className="h-11 p-1" value={cfg.accentColor} onChange={(e) => setCfg({ ...cfg, accentColor: e.target.value })} /></Field>
            <Field label="Cor do sofá" htmlFor="sofa"><Input id="sofa" type="color" className="h-11 p-1" value={cfg.sofaColor} onChange={(e) => setCfg({ ...cfg, sofaColor: e.target.value })} /></Field>
            <Field label="Tema" htmlFor="theme"><Select id="theme" disabled defaultValue="luxury"><option value="luxury">Luxo escuro (disponível)</option></Select></Field>
            <Checkbox checked={cfg.plants} onChange={(e) => setCfg({ ...cfg, plants: e.target.checked })} label="Plantas decorativas" />
            <Checkbox checked={cfg.neon} onChange={(e) => setCfg({ ...cfg, neon: e.target.checked })} label="Letreiro iluminado" />
            <Button type="submit" variant="secondary" disabled={saveCfg.pending} className="sm:col-span-2">Aplicar na prévia</Button>
          </form>
          <p className="mt-2 text-xs text-smoke">Temas Industrial, Minimalista e Clássico estão previstos na arquitetura e serão adicionados em versões futuras.</p>
        </Card>
      </div>

      <div className="order-first min-w-0 space-y-4 xl:order-none xl:sticky xl:top-20 xl:self-start">
        <div className="h-[320px] overflow-hidden sm:h-[440px] rounded-2xl border border-gold/20">
          <BarbershopExperience initialData={draft} viewer={viewer} today={today} maxAdvanceDays={30} variant="preview" embedded headerSlot={<Badge tone="gold" className="bg-black/70 px-3 py-1">Prévia do rascunho</Badge>} />
        </div>
        <FloorPlan draft={draft} />
      </div>
    </div>
  );
}

/** Planta baixa 2D (alternativa acessível à prévia 3D) */
function FloorPlan({ draft }: { draft: Draft }) {
  const W = ROOM.maxX - ROOM.minX;
  const D = ROOM.maxZ - ROOM.minZ;
  return (
    <Card className="p-4">
      <CardTitle>Planta baixa</CardTitle>
      <svg viewBox={`${ROOM.minX - 0.5} ${ROOM.minZ - 0.5} ${W + 1} ${D + 1.6}`} className="w-full" role="img" aria-label="Planta baixa com pontos de estação">
        <rect x={ROOM.minX} y={ROOM.minZ} width={W} height={D} fill="#1b1a18" stroke="#c8a165" strokeWidth="0.06" />
        <rect x={-6.4} y={2.2} width={3.2} height={0.9} fill="#3a2416" />
        <text x={-4.8} y={1.9} fontSize="0.35" fill="#8d867a" textAnchor="middle">Recepção</text>
        <rect x={-7} y={-3.2} width={1.4} height={3.4} fill="#5a3b2a" />
        <text x={-4.3} y={-1.5} fontSize="0.35" fill="#8d867a" textAnchor="middle">Espera</text>
        <line x1={-3.5} x2={-2.3} y1={ROOM.maxZ} y2={ROOM.maxZ} stroke="#e2c48f" strokeWidth="0.15" />
        <text x={-2.9} y={ROOM.maxZ + 0.6} fontSize="0.35" fill="#e2c48f" textAnchor="middle">Entrada</text>
        {STATION_SPOTS.map((p) => {
          const st = draft.stations.find((s) => s.spotKey === p.key && !s.deleted);
          return (
            <g key={p.key} transform={`translate(${p.x} ${p.z}) rotate(${(-(st?.rotationY ?? p.baseRotation) * 180) / Math.PI})`}>
              <rect x={-0.75} y={-0.3} width={1.5} height={0.5} fill={st ? (st.active ? "#5b3a24" : "#333") : "none"} stroke={st ? st.accentColor : "#4a463f"} strokeDasharray={st ? undefined : "0.15 0.1"} strokeWidth="0.05" />
              {st && <circle cx={0} cy={1.25} r={0.35} fill={st.active ? "#5e1d1a" : "#333"} stroke={st.accentColor} strokeWidth="0.04" />}
              <text x={0} y={st ? 2 : 0.6} fontSize="0.32" fill={st ? "#f2ece1" : "#6b665e"} textAnchor="middle">{st ? st.barber?.displayName.split(" ")[0] ?? st.name : p.key}</text>
            </g>
          );
        })}
      </svg>
    </Card>
  );
}
