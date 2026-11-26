/**
 * Ambiente 3D ↔ banco de dados.
 *
 * - getPublishedScene(): o que os clientes veem (somente dados publicados),
 *   com o estado real de cada estação para a data consultada.
 * - Editor de layout (proprietário): alterações ficam em draftJson até a
 *   publicação; a prévia mostra o rascunho aplicado.
 */
import { z } from "zod";
import { prisma } from "../db";
import { DomainError, notFound } from "../errors";
import { assertAdmin, type Actor } from "../actor";
import { audit } from "../audit";
import { getAvailability, listBarberServices } from "./appointments";
import { STATION_SPOTS, spotByKey, rotationFor, ROTATION_OFFSETS_DEG } from "@/features/barbershop-3d/layout";
import { DEFAULT_SCENE_CONFIG, type SceneConfigData, type SceneData, type SceneStation } from "@/features/barbershop-3d/types";
import type { StationState } from "@/types/domain";
import { safeJson } from "@/lib/utils";
import { addDays, todayIn, zonedToUtc } from "@/lib/time";

interface StationDraft {
  name?: string;
  spotKey?: string;
  rotationY?: number;
  model?: string;
  accentColor?: string;
  active?: boolean;
  barberProfileId?: string | null;
  deleted?: boolean;
}

type StationRow = Awaited<ReturnType<typeof loadStations>>[number];

function loadStations(shopId: string) {
  return prisma.station.findMany({
    where: { shopId },
    orderBy: { createdAt: "asc" },
    include: { barber: true },
  });
}

function effective(row: StationRow): StationRow & { draft: StationDraft; pending: boolean } {
  const draft = safeJson<StationDraft>(row.draftJson, {});
  return {
    ...row,
    name: draft.name ?? row.name,
    spotKey: draft.spotKey ?? row.spotKey,
    rotationY: draft.rotationY ?? row.rotationY,
    model: draft.model ?? row.model,
    accentColor: draft.accentColor ?? row.accentColor,
    active: draft.active ?? row.active,
    barberProfileId: draft.barberProfileId !== undefined ? draft.barberProfileId : row.barberProfileId,
    draft,
    pending: Boolean(row.draftJson) || !row.isPublished,
  };
}

function toBarber(b: { id: string; displayName: string; photoUrl: string | null; bio: string; specialties: string } | null) {
  if (!b) return null;
  return { id: b.id, displayName: b.displayName, photoUrl: b.photoUrl, bio: b.bio, specialties: safeJson<string[]>(b.specialties, []) };
}

async function stationState(shopId: string, barberId: string | null, date: string): Promise<{ state: StationState; detail: string | null }> {
  if (!barberId) return { state: "VACANT", detail: null };
  const barber = await prisma.barberProfile.findUnique({ where: { id: barberId }, include: { services: { where: { active: true, service: { active: true } }, include: { service: true } } } });
  if (!barber || barber.status !== "APPROVED" || !barber.userId) return { state: "VACANT", detail: null };
  if (barber.services.length === 0) return { state: "UNAVAILABLE", detail: "Sem serviços configurados" };
  const shop = await prisma.shop.findUniqueOrThrow({ where: { id: shopId } });
  const dayStart = zonedToUtc(date, 0, shop.timezone);
  const dayEnd = zonedToUtc(addDays(date, 1), 0, shop.timezone);
  const fullDayOff = await prisma.timeOff.findFirst({
    where: { barberProfileId: barberId, status: "APPROVED", kind: { in: ["DAY_OFF", "VACATION"] }, startsAt: { lte: dayStart }, endsAt: { gte: dayEnd } },
  });
  if (fullDayOff) return { state: "UNAVAILABLE", detail: fullDayOff.kind === "VACATION" ? "Em férias nesta data" : "Folga nesta data" };
  const minDuration = Math.min(...barber.services.map((s) => s.durationMin ?? s.service.durationMin));
  const { slots, reason } = await getAvailability({ shopId, barberProfileId: barberId, durationMin: minDuration, date });
  if (slots.length > 0) return { state: "AVAILABLE", detail: `${slots.length} horário(s) livre(s)` };
  if (reason && /não atende|fechada|Feriado|indisponível/.test(reason)) return { state: "UNAVAILABLE", detail: reason };
  return { state: "FULL", detail: reason };
}

export async function getSceneConfig(shopId: string, which: "published" | "draft" = "published"): Promise<SceneConfigData> {
  const cfg = await prisma.sceneConfig.findUnique({ where: { shopId } });
  const published = { ...DEFAULT_SCENE_CONFIG, ...safeJson<Partial<SceneConfigData>>(cfg?.publishedJson, {}) };
  if (which === "draft" && cfg?.draftJson) return { ...published, ...safeJson<Partial<SceneConfigData>>(cfg.draftJson, {}) };
  return published;
}

/** Cena pública: somente estações publicadas, com estados reais */
export async function getPublishedScene(shopId: string, date?: string): Promise<SceneData> {
  const shop = await prisma.shop.findUniqueOrThrow({ where: { id: shopId } });
  const day = date ?? todayIn(shop.timezone);
  const rows = await prisma.station.findMany({ where: { shopId, isPublished: true }, include: { barber: true }, orderBy: { createdAt: "asc" } });
  const stations: SceneStation[] = [];
  for (const r of rows) {
    const spot = spotByKey(r.spotKey);
    if (!spot) continue;
    const visibleBarber = r.barber && r.barber.status === "APPROVED" && r.barber.userId ? r.barber : null;
    const st = r.active ? await stationState(shopId, visibleBarber?.id ?? null, day) : { state: "INACTIVE" as const, detail: null };
    stations.push({
      id: r.id,
      name: r.name,
      spotKey: r.spotKey,
      x: spot.x,
      z: spot.z,
      rotationY: r.rotationY,
      model: r.model,
      accentColor: r.accentColor,
      active: r.active,
      barber: visibleBarber ? { ...toBarber(visibleBarber)!, services: await listBarberServices(visibleBarber.id) } : null,
      state: st.state,
      stateDetail: st.detail,
    });
  }
  return {
    shop: { name: shop.name, tagline: shop.tagline, logoUrl: shop.logoUrl },
    config: await getSceneConfig(shopId),
    stations,
    date: day,
  };
}

/** Cena de rascunho (prévia do editor) */
export async function getDraftScene(actor: Actor): Promise<SceneData & { freeSpots: string[]; hasPending: boolean }> {
  assertAdmin(actor);
  const shop = await prisma.shop.findUniqueOrThrow({ where: { id: actor.shopId } });
  const rows = (await loadStations(actor.shopId)).map(effective);
  const barberIds = rows.map((r) => r.barberProfileId).filter(Boolean) as string[];
  const barbers = await prisma.barberProfile.findMany({ where: { id: { in: barberIds } } });
  const stations: SceneStation[] = rows.map((r) => {
    const spot = spotByKey(r.spotKey)!;
    const b = barbers.find((x) => x.id === r.barberProfileId) ?? null;
    return {
      id: r.id,
      name: r.name,
      spotKey: r.spotKey,
      x: spot?.x ?? 0,
      z: spot?.z ?? 0,
      rotationY: r.rotationY,
      model: r.model,
      accentColor: r.accentColor,
      active: r.active,
      barber: toBarber(b),
      state: !r.active ? "INACTIVE" : b ? (b.status === "APPROVED" && b.userId ? "AVAILABLE" : "UNAVAILABLE") : "VACANT",
      stateDetail: b && b.status === "INVITED" ? "Convite pendente" : null,
      pending: r.pending,
      deleted: Boolean(r.draft.deleted),
      isNew: !r.isPublished,
    };
  });
  const cfg = await prisma.sceneConfig.findUnique({ where: { shopId: actor.shopId } });
  const used = new Set(stations.filter((s) => !s.deleted).map((s) => s.spotKey));
  return {
    shop: { name: shop.name, tagline: shop.tagline, logoUrl: shop.logoUrl },
    config: await getSceneConfig(actor.shopId, "draft"),
    stations,
    date: todayIn(shop.timezone),
    freeSpots: STATION_SPOTS.filter((s) => !used.has(s.key)).map((s) => s.key),
    hasPending: stations.some((s) => s.pending) || Boolean(cfg?.draftJson),
  };
}

// ─── Operações do editor ─────────────────────────────────────────────────────

export const addStationSchema = z.object({
  name: z.string().trim().min(2).max(40),
  model: z.enum(["classic", "modern"]),
  spotKey: z.string().optional(),
  barberProfileId: z.string().optional().nullable(),
});

export async function addStation(actor: Actor, raw: unknown) {
  assertAdmin(actor);
  const input = addStationSchema.parse(raw);
  const scene = await getDraftScene(actor);
  if (scene.freeSpots.length === 0) {
    throw new DomainError("Não há espaço disponível para uma nova estação. Desative ou remova uma estação existente.");
  }
  const spotKey = input.spotKey ?? scene.freeSpots[0];
  if (!scene.freeSpots.includes(spotKey)) throw new DomainError("Este ponto já está ocupado por outra estação.");
  if (input.barberProfileId) await assertBarberAssignable(actor, input.barberProfileId, null);
  const station = await prisma.station.create({
    data: {
      shopId: actor.shopId,
      name: input.name,
      model: input.model,
      spotKey,
      rotationY: rotationFor(spotKey, 0),
      isPublished: false,
      active: true,
      draftJson: JSON.stringify({ barberProfileId: input.barberProfileId ?? null }),
    },
  });
  await audit({ shopId: actor.shopId, actorUserId: actor.userId, action: "STATION_DRAFT_ADDED", entity: "Station", entityId: station.id, data: input });
  return station;
}

async function assertBarberAssignable(actor: Actor, barberProfileId: string, stationId: string | null) {
  const barber = await prisma.barberProfile.findFirst({ where: { id: barberProfileId, shopId: actor.shopId } });
  if (!barber || !["APPROVED", "INVITED"].includes(barber.status)) throw new DomainError("Profissional inválido ou inativo.");
  const rows = (await loadStations(actor.shopId)).map(effective);
  const taken = rows.find((r) => r.id !== stationId && !r.draft.deleted && r.barberProfileId === barberProfileId);
  if (taken) throw new DomainError(`Este profissional já está vinculado à ${taken.name}. Libere a estação antes.`);
}

export const updateStationSchema = z.object({
  name: z.string().trim().min(2).max(40).optional(),
  spotKey: z.string().optional(),
  rotationOffsetDeg: z.coerce.number().refine((v) => (ROTATION_OFFSETS_DEG as readonly number[]).includes(v), "Giro inválido").optional(),
  model: z.enum(["classic", "modern"]).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  active: z.boolean().optional(),
  barberProfileId: z.string().nullable().optional(),
});

export async function updateStationDraft(actor: Actor, stationId: string, raw: unknown) {
  assertAdmin(actor);
  const input = updateStationSchema.parse(raw);
  const row = await prisma.station.findFirst({ where: { id: stationId, shopId: actor.shopId }, include: { barber: true } });
  if (!row) throw notFound("Estação não encontrada.");
  const eff = effective(row);
  const draft: StationDraft = { ...eff.draft };
  if (input.name !== undefined) draft.name = input.name;
  if (input.model !== undefined) draft.model = input.model;
  if (input.accentColor !== undefined) draft.accentColor = input.accentColor;
  if (input.active !== undefined) draft.active = input.active;
  const spotKey = input.spotKey ?? eff.spotKey;
  if (input.spotKey !== undefined && input.spotKey !== eff.spotKey) {
    if (!spotByKey(input.spotKey)) throw new DomainError("Ponto inválido.");
    const rows = (await loadStations(actor.shopId)).map(effective);
    if (rows.some((r) => r.id !== stationId && !r.draft.deleted && r.spotKey === input.spotKey)) throw new DomainError("Este ponto já está ocupado por outra estação.");
    draft.spotKey = input.spotKey;
    draft.rotationY = rotationFor(input.spotKey, input.rotationOffsetDeg ?? 0);
  } else if (input.rotationOffsetDeg !== undefined) {
    draft.rotationY = rotationFor(spotKey, input.rotationOffsetDeg);
  }
  if (input.barberProfileId !== undefined) {
    if (input.barberProfileId) await assertBarberAssignable(actor, input.barberProfileId, stationId);
    draft.barberProfileId = input.barberProfileId;
  }
  await prisma.station.update({ where: { id: stationId }, data: { draftJson: JSON.stringify(draft) } });
}

export async function markStationDeleted(actor: Actor, stationId: string) {
  assertAdmin(actor);
  const row = await prisma.station.findFirst({ where: { id: stationId, shopId: actor.shopId } });
  if (!row) throw notFound("Estação não encontrada.");
  const linked = await prisma.appointment.count({ where: { stationId } });
  if (linked > 0) throw new DomainError("Esta estação possui reservas vinculadas e não pode ser removida. Você pode desativá-la.");
  if (!row.isPublished) {
    await prisma.station.delete({ where: { id: stationId } });
    return;
  }
  const draft = { ...safeJson<StationDraft>(row.draftJson, {}), deleted: true };
  await prisma.station.update({ where: { id: stationId }, data: { draftJson: JSON.stringify(draft) } });
}

export async function discardDrafts(actor: Actor) {
  assertAdmin(actor);
  await prisma.$transaction([
    prisma.station.deleteMany({ where: { shopId: actor.shopId, isPublished: false } }),
    prisma.station.updateMany({ where: { shopId: actor.shopId }, data: { draftJson: null } }),
    prisma.sceneConfig.updateMany({ where: { shopId: actor.shopId }, data: { draftJson: null } }),
  ]);
}

export const sceneConfigSchema = z.object({
  signText: z.string().trim().min(1).max(24),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  plants: z.boolean(),
  sofaColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  neon: z.boolean(),
});

export async function updateSceneConfigDraft(actor: Actor, raw: unknown) {
  assertAdmin(actor);
  const input = sceneConfigSchema.parse(raw);
  await prisma.sceneConfig.upsert({
    where: { shopId: actor.shopId },
    create: { shopId: actor.shopId, publishedJson: JSON.stringify(DEFAULT_SCENE_CONFIG), draftJson: JSON.stringify(input) },
    update: { draftJson: JSON.stringify(input) },
  });
}

/** Publica rascunhos: valida conflitos e aplica tudo numa transação */
export async function publishLayout(actor: Actor) {
  assertAdmin(actor);
  const rows = (await loadStations(actor.shopId)).map(effective);
  const alive = rows.filter((r) => !r.draft.deleted);
  const spots = new Set<string>();
  const barbers = new Set<string>();
  for (const r of alive) {
    if (!spotByKey(r.spotKey)) throw new DomainError(`${r.name}: ponto inválido.`);
    if (spots.has(r.spotKey)) throw new DomainError(`Duas estações no mesmo ponto (${r.spotKey}).`);
    spots.add(r.spotKey);
    if (r.barberProfileId) {
      if (barbers.has(r.barberProfileId)) throw new DomainError("Um profissional está vinculado a mais de uma estação.");
      barbers.add(r.barberProfileId);
    }
  }
  for (const r of rows.filter((x) => x.draft.deleted)) {
    if ((await prisma.appointment.count({ where: { stationId: r.id } })) > 0) throw new DomainError(`${r.name} possui reservas vinculadas e não pode ser removida.`);
  }
  await prisma.$transaction(async (tx) => {
    const changed = rows.filter((r) => r.pending);
    // Libera vínculos primeiro para permitir trocas de profissional entre estações
    await tx.station.updateMany({ where: { id: { in: changed.map((r) => r.id) } }, data: { barberProfileId: null } });
    for (const r of changed) {
      if (r.draft.deleted) {
        await tx.station.delete({ where: { id: r.id } });
        continue;
      }
    }
    for (const r of changed.filter((x) => !x.draft.deleted)) {
      await tx.station.update({
        where: { id: r.id },
        data: { name: r.name, spotKey: r.spotKey, rotationY: r.rotationY, model: r.model, accentColor: r.accentColor, active: r.active, barberProfileId: r.barberProfileId, isPublished: true, draftJson: null },
      });
    }
    const cfg = await tx.sceneConfig.findUnique({ where: { shopId: actor.shopId } });
    if (cfg?.draftJson) {
      const merged = { ...safeJson(cfg.publishedJson, {}), ...safeJson(cfg.draftJson, {}) };
      await tx.sceneConfig.update({ where: { id: cfg.id }, data: { publishedJson: JSON.stringify(merged), draftJson: null, publishedAt: new Date() } });
    }
    await audit({ shopId: actor.shopId, actorUserId: actor.userId, action: "LAYOUT_PUBLISHED", entity: "Station", data: { changed: changed.map((c) => c.id) } }, tx);
  });
}
