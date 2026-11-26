import { headers } from "next/headers";
import { getSession, type SessionContext } from "./auth/session";
import { toActionError } from "./errors";
import { rateLimit } from "./rate-limit";
import type { ActionResult } from "@/types/domain";

/** Executa uma operação autenticada convertendo erros em ActionResult */
export async function authed<T>(fn: (s: SessionContext) => Promise<T | ActionResult<T>>, message?: string): Promise<ActionResult<T>> {
  try {
    const s = await getSession();
    if (!s) return { ok: false, error: "Sua sessão expirou. Entre novamente." };
    const out = await fn(s);
    if (out && typeof out === "object" && "ok" in (out as object)) return out as ActionResult<T>;
    return { ok: true, message, data: out as T };
  } catch (err) {
    return toActionError(err);
  }
}

export async function publicAction<T>(fn: () => Promise<T>, message?: string): Promise<ActionResult<T>> {
  try {
    return { ok: true, message, data: await fn() };
  } catch (err) {
    return toActionError(err);
  }
}

export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
}

export async function limitByIp(scope: string, limit: number, windowSeconds: number) {
  await rateLimit(`${scope}:${await clientIp()}`, limit, windowSeconds);
}
