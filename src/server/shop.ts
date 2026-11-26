import { cache } from "react";
import { prisma } from "./db";

export const SHOP_SLUG = process.env.SHOP_SLUG || "barberverse";

/** Estabelecimento atendido por esta instalação (null antes do /setup) */
export const getShop = cache(async () => {
  return prisma.shop.findUnique({ where: { slug: SHOP_SLUG } });
});

export async function requireShop() {
  const shop = await getShop();
  if (!shop) {
    const { redirect } = await import("next/navigation");
    redirect("/setup");
  }
  return shop!;
}
