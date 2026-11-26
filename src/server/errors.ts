import { ZodError } from "zod";
import type { ActionResult } from "@/types/domain";

/** Erro de regra de negócio com mensagem segura para exibir ao usuário */
export class DomainError extends Error {
  constructor(
    message: string,
    public code: "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "INVALID" | "RATE_LIMITED" | "UNAUTHENTICATED" = "INVALID",
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export const forbidden = (msg = "Você não tem permissão para esta ação.") => new DomainError(msg, "FORBIDDEN");
export const notFound = (msg = "Registro não encontrado.") => new DomainError(msg, "NOT_FOUND");

/** Converte exceções em ActionResult sem vazar detalhes internos */
export function toActionError(err: unknown): ActionResult<never> {
  if (err instanceof DomainError) return { ok: false, error: err.message };
  if (err instanceof ZodError) {
    const flat = err.flatten();
    const first = Object.values(flat.fieldErrors).flat()[0] ?? flat.formErrors[0] ?? "Dados inválidos.";
    return { ok: false, error: String(first), fieldErrors: flat.fieldErrors as Record<string, string[]> };
  }
  // Redirects do Next precisam propagar
  if (typeof err === "object" && err && "digest" in err && String((err as { digest: unknown }).digest).startsWith("NEXT_")) {
    throw err;
  }
  console.error("[action-error]", err);
  return { ok: false, error: "Não foi possível concluir a operação. Tente novamente." };
}
