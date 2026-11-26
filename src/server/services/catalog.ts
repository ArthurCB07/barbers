/** Serviços, categorias, configurações da barbearia, horários e feriados */
import { z } from "zod";
import { prisma, isUniqueViolation } from "../db";
import { DomainError, notFound } from "../errors";
import { assertAdmin, type Actor } from "../actor";
import { audit } from "../audit";
import { isValidDateStr } from "@/lib/time";

export const serviceSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(400).default(""),
  priceCents: z.coerce.number().int().min(0, "Preço inválido").max(10_000_00),
  durationMin: z.coerce.number().int().min(5).max(480).refine((v) => v % 5 === 0, "Use múltiplos de 5 minutos"),
  categoryId: z.string().nullable().optional(),
  imageUrl: z.string().max(300).nullable().optional(),
  active: z.boolean().default(true),
  barberIds: z.array(z.string()).default([]),
});

export async function upsertService(actor: Actor, id: string | null, raw: unknown) {
  assertAdmin(actor);
  const input = serviceSchema.parse(raw);
  if (input.categoryId) {
    const cat = await prisma.serviceCategory.findFirst({ where: { id: input.categoryId, shopId: actor.shopId } });
    if (!cat) throw notFound("Categoria não encontrada.");
  }
  return prisma.$transaction(async (tx) => {
    const data = { name: input.name, description: input.description, priceCents: input.priceCents, durationMin: input.durationMin, categoryId: input.categoryId ?? null, imageUrl: input.imageUrl ?? null, active: input.active };
    let service;
    if (id) {
      const existing = await tx.service.findFirst({ where: { id, shopId: actor.shopId } });
      if (!existing) throw notFound("Serviço não encontrado.");
      service = await tx.service.update({ where: { id }, data });
    } else {
      const count = await tx.service.count({ where: { shopId: actor.shopId } });
      service = await tx.service.create({ data: { ...data, shopId: actor.shopId, sortOrder: count } });
    }
    // Profissionais habilitados
    const barbers = await tx.barberProfile.findMany({ where: { shopId: actor.shopId, id: { in: input.barberIds } }, select: { id: true } });
    const enabled = new Set(barbers.map((b) => b.id));
    const current = await tx.barberService.findMany({ where: { serviceId: service.id } });
    for (const bs of current) {
      if (!enabled.has(bs.barberProfileId) && bs.active) await tx.barberService.update({ where: { id: bs.id }, data: { active: false } });
    }
    for (const barberProfileId of enabled) {
      await tx.barberService.upsert({
        where: { barberProfileId_serviceId: { barberProfileId, serviceId: service.id } },
        create: { barberProfileId, serviceId: service.id },
        update: { active: true },
      });
    }
    await audit({ shopId: actor.shopId, actorUserId: actor.userId, action: id ? "SERVICE_UPDATED" : "SERVICE_CREATED", entity: "Service", entityId: service.id, data: input }, tx);
    return service;
  });
}

export async function toggleService(actor: Actor, id: string, active: boolean) {
  assertAdmin(actor);
  const res = await prisma.service.updateMany({ where: { id, shopId: actor.shopId }, data: { active } });
  if (!res.count) throw notFound();
}

export async function createCategory(actor: Actor, name: string) {
  assertAdmin(actor);
  const clean = z.string().trim().min(2).max(40).parse(name);
  try {
    const count = await prisma.serviceCategory.count({ where: { shopId: actor.shopId } });
    return await prisma.serviceCategory.create({ data: { shopId: actor.shopId, name: clean, sortOrder: count } });
  } catch (err) {
    if (isUniqueViolation(err)) throw new DomainError("Já existe uma categoria com esse nome.");
    throw err;
  }
}

export const shopSettingsSchema = z.object({
  name: z.string().trim().min(2).max(80),
  tagline: z.string().trim().max(120).default(""),
  description: z.string().trim().max(800).default(""),
  address: z.string().trim().max(200).default(""),
  city: z.string().trim().max(80).default(""),
  phone: z.string().trim().max(20).default(""),
  whatsapp: z.string().trim().max(20).default(""),
  instagram: z.string().trim().max(60).default(""),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  logoUrl: z.string().max(300).nullable().optional(),
  slotStepMinutes: z.coerce.number().int().refine((v) => [5, 10, 15, 20, 30, 60].includes(v), "Intervalo inválido"),
  bufferMinutes: z.coerce.number().int().min(0).max(60).refine((v) => v % 5 === 0, "Use múltiplos de 5"),
  minAdvanceMinutes: z.coerce.number().int().min(0).max(7 * 1440),
  maxAdvanceDays: z.coerce.number().int().min(1).max(365),
  cancelPolicyHours: z.coerce.number().int().min(0).max(168),
  autoConfirm: z.boolean(),
  cancellationPolicyText: z.string().trim().max(800).default(""),
  barberCanBlockAgenda: z.boolean(),
  barberCanEditPrices: z.boolean(),
});

export async function updateShopSettings(actor: Actor, raw: unknown) {
  assertAdmin(actor);
  const input = shopSettingsSchema.parse(raw);
  await prisma.shop.update({ where: { id: actor.shopId }, data: { ...input, logoUrl: input.logoUrl === undefined ? undefined : input.logoUrl } });
  await audit({ shopId: actor.shopId, actorUserId: actor.userId, action: "SHOP_SETTINGS_UPDATED", entity: "Shop", entityId: actor.shopId });
}

export const shopHoursSchema = z.array(
  z.object({ weekday: z.number().int().min(0).max(6), closed: z.boolean(), openMin: z.number().int().min(0).max(1440), closeMin: z.number().int().min(0).max(1440) })
    .refine((h) => h.closed || h.closeMin > h.openMin, "Horário de fechamento deve ser após a abertura"),
);

export async function updateShopHours(actor: Actor, raw: unknown) {
  assertAdmin(actor);
  const days = shopHoursSchema.parse(raw);
  await prisma.$transaction(
    days.map((d) =>
      prisma.shopHours.upsert({
        where: { shopId_weekday: { shopId: actor.shopId, weekday: d.weekday } },
        create: { shopId: actor.shopId, ...d },
        update: { closed: d.closed, openMin: d.openMin, closeMin: d.closeMin },
      }),
    ),
  );
}

export async function addHoliday(actor: Actor, date: string, name: string) {
  assertAdmin(actor);
  if (!isValidDateStr(date)) throw new DomainError("Data inválida.");
  const clean = z.string().trim().min(2).max(60).parse(name);
  try {
    await prisma.holiday.create({ data: { shopId: actor.shopId, date, name: clean } });
  } catch (err) {
    if (isUniqueViolation(err)) throw new DomainError("Já existe um feriado nesta data.");
    throw err;
  }
}

export async function removeHoliday(actor: Actor, id: string) {
  assertAdmin(actor);
  await prisma.holiday.deleteMany({ where: { id, shopId: actor.shopId } });
}
