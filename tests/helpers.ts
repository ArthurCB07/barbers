import { prisma } from "@/server/db";
import { bootstrapShop, registerClient } from "@/server/services/accounts";
import { loadActor } from "@/server/actor";
import { addDays, todayIn, weekdayOf } from "@/lib/time";

export async function resetDb() {
  const tables = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'",
  );
  // Mesma conexão/transação: as FKs são verificadas só no commit, com tudo vazio
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("PRAGMA defer_foreign_keys = ON");
    for (const t of tables) await tx.$executeRawUnsafe(`DELETE FROM "${t.name}"`);
  });
}

export const OWNER = { email: "owner@test.dev", password: "Owner12345" };

export async function setupShop() {
  await resetDb();
  const { shop, owner } = await bootstrapShop("barberverse", {
    shopName: "Test Barber",
    ownerName: "Owner Test",
    ownerEmail: OWNER.email,
    ownerPhone: "11999990000",
    ownerPassword: OWNER.password,
    ownerDisplayName: "Owner Barber",
    ownerIsBarber: true,
  });
  // Sem antecedência mínima para facilitar testes determinísticos
  await prisma.shop.update({ where: { id: shop.id }, data: { minAdvanceMinutes: 0 } });
  const ownerActor = await loadActor(owner.id, shop.id);
  const ownerBarber = await prisma.barberProfile.findFirstOrThrow({ where: { userId: owner.id } });
  return { shop, owner, ownerActor, ownerBarber };
}

let counter = 0;
export async function newClient(shopId: string, name = "Cliente Teste") {
  counter++;
  const email = `client${counter}-${Date.now()}@test.dev`;
  const user = await registerClient(shopId, {
    name,
    email,
    phone: "11988887777",
    password: "Senha12345",
    confirmPassword: "Senha12345",
    acceptTerms: true,
  });
  return { user, actor: await loadActor(user.id, shopId) };
}

/** Próxima terça-feira (dia útil) pelo menos 7 dias à frente */
export function nextTuesday() {
  let d = addDays(todayIn("America/Sao_Paulo"), 7);
  while (weekdayOf(d) !== 2) d = addDays(d, 1);
  return d;
}

export async function firstServiceOf(barberProfileId: string) {
  const bs = await prisma.barberService.findFirstOrThrow({ where: { barberProfileId, active: true }, include: { service: true }, orderBy: { service: { sortOrder: "asc" } } });
  return bs.service;
}
