import { prisma } from "./db";
import { DomainError } from "./errors";

/**
 * Rate limiting em janela fixa persistido no banco (funciona com múltiplas
 * instâncias). Lança DomainError quando o limite é excedido.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  if (process.env.DISABLE_RATE_LIMIT === "1") return;
  const now = new Date();
  const windowEnd = new Date(now.getTime() + windowSeconds * 1000);
  const count = await prisma.$transaction(async (tx) => {
    const current = await tx.rateLimit.findUnique({ where: { key } });
    if (!current || current.windowEnd < now) {
      await tx.rateLimit.upsert({ where: { key }, create: { key, count: 1, windowEnd }, update: { count: 1, windowEnd } });
      return 1;
    }
    const updated = await tx.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
    return updated.count;
  });
  if (count > limit) {
    throw new DomainError("Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.", "RATE_LIMITED");
  }
}
