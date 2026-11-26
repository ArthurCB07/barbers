import { prisma } from "../db";

/** Estações publicadas com ocupação atual (para selects de vínculo) */
export async function stationOptions(shopId: string) {
  const stations = await prisma.station.findMany({ where: { shopId, isPublished: true }, include: { barber: true }, orderBy: { createdAt: "asc" } });
  return stations.map((s) => ({ id: s.id, name: s.name, occupiedBy: s.barber && s.barber.status !== "INACTIVE" ? s.barber.displayName : null }));
}

export async function serviceOptions(shopId: string) {
  const services = await prisma.service.findMany({ where: { shopId, active: true }, orderBy: { sortOrder: "asc" } });
  return services.map((s) => ({ id: s.id, name: s.name, priceCents: s.priceCents, durationMin: s.durationMin }));
}
