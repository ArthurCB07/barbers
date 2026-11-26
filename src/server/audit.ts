import type { Tx } from "./db";
import { prisma } from "./db";

export async function audit(
  params: { shopId: string; actorUserId?: string | null; action: string; entity: string; entityId?: string | null; data?: unknown },
  tx: Tx = prisma,
) {
  await tx.auditLog.create({
    data: {
      shopId: params.shopId,
      actorUserId: params.actorUserId ?? null,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId ?? null,
      data: JSON.stringify(params.data ?? {}),
    },
  });
}
