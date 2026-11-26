"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSession, destroySession, getSession } from "../auth/session";
import { requireShop, SHOP_SLUG } from "../shop";
import * as accounts from "../services/accounts";
import { toActionError, DomainError } from "../errors";
import { limitByIp, authed, publicAction } from "../action-utils";
import { rateLimit } from "../rate-limit";
import { ROLE_HOME, type ActionResult, type Role } from "@/types/domain";

function safeNext(next: unknown): string | null {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export async function loginAction(input: { email: string; password: string; preferredRole?: string; next?: string }): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const shop = await requireShop();
    await limitByIp("login", 20, 15 * 60);
    await rateLimit(`login-email:${String(input.email).toLowerCase()}`, 8, 15 * 60);
    const { user, roles } = await accounts.authenticate(shop.id, input);
    const active = accounts.pickActiveRole(roles, input.preferredRole);
    await createSession(user.id, active);
    return { ok: true, data: { redirectTo: safeNext(input.next) ?? ROLE_HOME[active] } };
  } catch (err) {
    return toActionError(err);
  }
}

export async function registerClientAction(input: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const shop = await requireShop();
    await limitByIp("register", 10, 60 * 60);
    const user = await accounts.registerClient(shop.id, input);
    await createSession(user.id, "CLIENT");
    const next = safeNext((input as { next?: string })?.next);
    return { ok: true, data: { redirectTo: next ?? "/barbearia" } };
  } catch (err) {
    return toActionError(err);
  }
}

export async function registerBarberAction(input: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const shop = await requireShop();
    await limitByIp("register", 10, 60 * 60);
    const { user } = await accounts.registerBarber(shop.id, input);
    await createSession(user.id, "CLIENT");
    return { ok: true, data: { redirectTo: "/barbeiro/aguardando" } };
  } catch (err) {
    return toActionError(err);
  }
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

export async function switchRoleAction(role: Role): Promise<ActionResult<{ redirectTo: string }>> {
  return authed(async (s) => {
    await accounts.switchRole(s.actor, s.sessionId, role);
    revalidatePath("/", "layout");
    return { redirectTo: ROLE_HOME[role] };
  });
}

export async function forgotPasswordAction(email: string): Promise<ActionResult<{ devLink?: string }>> {
  try {
    await limitByIp("forgot", 5, 15 * 60);
    const res = await accounts.requestPasswordReset(email);
    // Link exibido somente em desenvolvimento (sem provedor de e-mail configurado)
    const devLink = process.env.NODE_ENV !== "production" && res ? res.link : undefined;
    return { ok: true, message: "Se o e-mail estiver cadastrado, enviaremos as instruções.", data: { devLink } };
  } catch (err) {
    return toActionError(err);
  }
}

export async function resetPasswordAction(token: string, password: string, confirm: string): Promise<ActionResult> {
  try {
    await limitByIp("reset", 10, 15 * 60);
    await accounts.resetPassword(token, password, confirm);
    return { ok: true, message: "Senha redefinida. Entre com a nova senha." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function acceptInviteAction(token: string, input: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    await limitByIp("invite", 10, 15 * 60);
    const session = await getSession();
    const { userId } = await accounts.acceptInvite(token, input, session?.user.id);
    if (session) await destroySession();
    await createSession(userId, "BARBER");
    return { ok: true, data: { redirectTo: "/barbeiro" } };
  } catch (err) {
    return toActionError(err);
  }
}

export async function setupAction(input: { token: string } & Record<string, unknown>): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    await limitByIp("setup", 10, 60 * 60);
    const expected = process.env.SETUP_TOKEN;
    if (!expected || expected.startsWith("troque-") && process.env.NODE_ENV === "production") throw new DomainError("Defina um SETUP_TOKEN seguro nas variáveis de ambiente antes de continuar.");
    if (input.token !== expected) throw new DomainError("Token de configuração inválido.");
    const { owner } = await accounts.bootstrapShop(SHOP_SLUG, input);
    await createSession(owner.id, "ADMIN");
    return { ok: true, data: { redirectTo: "/admin" } };
  } catch (err) {
    return toActionError(err);
  }
}

export async function requestPartnershipAction(input: unknown) {
  return authed(async (s) => {
    await accounts.requestPartnership(s.actor, input);
    revalidatePath("/", "layout");
  }, "Solicitação enviada! Você será avisado quando o proprietário responder.");
}

export async function resubmitPartnerAction(input: unknown) {
  return authed(async (s) => {
    await accounts.resubmitPartnerRequest(s.actor, input);
    revalidatePath("/barbeiro/aguardando");
  }, "Dados enviados para nova análise.");
}

/** Candidato atualiza a própria foto enquanto aguarda análise */
export async function updatePendingPhotoAction(photoUrl: string | null) {
  return authed(async (s) => {
    if (photoUrl !== null && !/^\/api\/files\/[A-Za-z0-9_-]+\.(jpg|png|webp)$/.test(photoUrl)) throw new DomainError("Imagem inválida.");
    const { prisma } = await import("../db");
    const res = await prisma.barberProfile.updateMany({ where: { userId: s.user.id, shopId: s.actor.shopId, status: { in: ["PENDING", "NEEDS_INFO"] } }, data: { photoUrl } });
    if (res.count === 0) throw new DomainError("Nenhuma solicitação pendente.");
    revalidatePath("/barbeiro/aguardando");
  }, "Foto atualizada.");
}

export async function pingAction() {
  return publicAction(async () => true);
}
