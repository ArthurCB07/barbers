import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "../db";
import { getShop } from "../shop";
import { hashToken, newToken } from "./crypto";
import { loadActor, type Actor } from "../actor";
import { ROLE_HOME, type Role } from "@/types/domain";

export const SESSION_COOKIE = "bv_session";
const SESSION_DAYS = 30;

export async function createSession(userId: string, activeRole: Role) {
  const token = newToken();
  const ua = (await headers()).get("user-agent")?.slice(0, 200) ?? "";
  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      activeRole,
      userAgent: ua,
      expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000),
    },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

export interface SessionContext {
  sessionId: string;
  activeRole: Role;
  user: { id: string; name: string; email: string; phone: string };
  actor: Actor;
  barberStatus: string | null;
}

/** Sessão atual (memoizada por requisição). Valida expiração no banco. */
export const getSession = cache(async (): Promise<SessionContext | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const shop = await getShop();
  if (!shop) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, name: true, email: true, phone: true, anonymizedAt: true } } },
  });
  if (!session || session.expiresAt < new Date() || session.user.anonymizedAt) return null;
  const actor = await loadActor(session.userId, shop.id);
  const barber = await prisma.barberProfile.findFirst({ where: { userId: session.userId, shopId: shop.id }, select: { status: true } });
  let activeRole = session.activeRole as Role;
  if (!actor.roles.includes(activeRole)) activeRole = actor.roles[0] ?? "CLIENT";
  return {
    sessionId: session.id,
    activeRole,
    user: { id: session.user.id, name: session.user.name, email: session.user.email, phone: session.user.phone },
    actor,
    barberStatus: barber?.status ?? null,
  };
});

export async function requireSession(next?: string) {
  const s = await getSession();
  if (!s) redirect(`/entrar${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return s;
}

/** Exige papel específico. Barbeiro precisa estar APROVADO. */
export async function requireRole(role: Role, next?: string) {
  const s = await requireSession(next);
  if (role === "BARBER") {
    if (!s.actor.barberProfileId) {
      if (s.barberStatus && s.barberStatus !== "APPROVED") redirect("/barbeiro/aguardando");
      redirect("/sem-acesso");
    }
  } else if (!s.actor.roles.includes(role)) {
    redirect("/sem-acesso");
  }
  return s;
}

export function homeFor(s: SessionContext) {
  return ROLE_HOME[s.activeRole];
}
