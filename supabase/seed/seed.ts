/**
 * Dados de DEMONSTRAÇÃO para desenvolvimento. Não execute em produção —
 * em produção use a rota /setup (com SETUP_TOKEN) para criar o primeiro
 * proprietário.
 *
 * Contas de demonstração (somente ambiente local):
 *   Proprietário + barbeiro inicial:  dono@barberverse.test     / Barber2026!
 *   Cliente:                          cliente@barberverse.test  / Cliente2026!
 *   Candidato a barbeiro (pendente):  candidato@barberverse.test / Candidato2026!
 */
import { prisma } from "../../src/server/db";
import { bootstrapShop, registerBarber, registerClient } from "../../src/server/services/accounts";
import { SHOP_SLUG } from "../../src/server/shop";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Seed de demonstração bloqueado em produção.");
  const existing = await prisma.shop.findUnique({ where: { slug: SHOP_SLUG } });
  if (existing) {
    console.log(`Barbearia "${existing.name}" já existe — seed ignorado. Use npm run db:reset para recriar.`);
    return;
  }
  const { shop } = await bootstrapShop(SHOP_SLUG, {
    shopName: "Barberverse",
    ownerName: "Rafael Monteiro",
    ownerEmail: "dono@barberverse.test",
    ownerPhone: "(11) 99876-5432",
    ownerPassword: "Barber2026!",
    ownerDisplayName: "Rafa Monteiro",
    ownerIsBarber: true,
  });
  await prisma.shop.update({
    where: { id: shop.id },
    data: {
      tagline: "Barbearia premium · desde 2014",
      address: "Rua Augusta, 1200 — Consolação",
      city: "São Paulo / SP",
      phone: "(11) 3333-1200",
      whatsapp: "(11) 99876-5432",
      instagram: "@barberverse",
    },
  });
  await registerClient(shop.id, {
    name: "Lucas Andrade",
    email: "cliente@barberverse.test",
    phone: "(11) 91234-5678",
    password: "Cliente2026!",
    confirmPassword: "Cliente2026!",
    acceptTerms: true,
  });
  await registerBarber(shop.id, {
    name: "Diego Carvalho",
    email: "candidato@barberverse.test",
    phone: "(11) 95555-0101",
    password: "Candidato2026!",
    confirmPassword: "Candidato2026!",
    displayName: "Diego Fade",
    bio: "Especialista em degradê e desenhos. 6 anos de experiência em barbearias de São Paulo.",
    specialties: ["Degradê", "Freestyle", "Pigmentação"],
    experience: "Barbearia Vintage (2019–2024), cursos de visagismo.",
    message: "Gostaria de fazer parte da equipe às terças e sábados.",
    acceptTerms: true,
  });
  // Feriados nacionais próximos (exemplo)
  for (const [date, name] of [["2026-12-25", "Natal"], ["2027-01-01", "Confraternização Universal"]]) {
    await prisma.holiday.create({ data: { shopId: shop.id, date, name } });
  }
  console.log("Seed concluído. Contas de demonstração no cabeçalho de supabase/seed/seed.ts");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
