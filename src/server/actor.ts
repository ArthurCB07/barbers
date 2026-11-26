import { prisma } from "./db";
import { forbidden } from "./errors";
import type { Role } from "@/types/domain";

/**
 * Identidade de quem executa uma operação. Toda regra de negócio recebe um
 * Actor e verifica permissões no servidor — nunca confia na interface.
 */
export interface Actor {
  userId: string;
  shopId: string;
  roles: Role[];
  /** Preenchido apenas se o usuário for barbeiro APROVADO com papel BARBER */
  barberProfileId: string | null;
}

export async function loadActor(userId: string, shopId: string): Promise<Actor> {
  const [roles, barber] = await Promise.all([
    prisma.roleAssignment.findMany({ where: { userId, shopId }, select: { role: true } }),
    prisma.barberProfile.findFirst({ where: { userId, shopId }, select: { id: true, status: true } }),
  ]);
  const roleList = roles.map((r) => r.role as Role);
  return {
    userId,
    shopId,
    roles: roleList,
    barberProfileId: barber && barber.status === "APPROVED" && roleList.includes("BARBER") ? barber.id : null,
  };
}

export const hasRole = (a: Actor, role: Role) => a.roles.includes(role);
export const isAdmin = (a: Actor) => hasRole(a, "ADMIN");

export function assertAdmin(a: Actor) {
  if (!isAdmin(a)) throw forbidden("Apenas o proprietário pode realizar esta ação.");
}

export function assertBarber(a: Actor): string {
  if (!a.barberProfileId) throw forbidden("Acesso restrito a profissionais aprovados.");
  return a.barberProfileId;
}

export function assertClient(a: Actor) {
  if (!hasRole(a, "CLIENT")) throw forbidden("Acesso restrito a clientes.");
}
