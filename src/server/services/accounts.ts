/**
 * Contas, papéis, parceria de barbeiros e convites.
 * Nenhuma rota pública cria administradores: o primeiro proprietário nasce
 * via bootstrapShop() (rota /setup protegida por SETUP_TOKEN ou seed de dev).
 */
import { z } from "zod";
import { prisma, isUniqueViolation, type Tx } from "../db";
import { DomainError, forbidden, notFound } from "../errors";
import { assertAdmin, type Actor } from "../actor";
import { hashPassword, hashToken, newToken, verifyPassword } from "../auth/crypto";
import { audit } from "../audit";
import { notify, notifyAdmins } from "./notifications";
import type { Role } from "@/types/domain";

// ─── Validação ───────────────────────────────────────────────────────────────

export const passwordSchema = z
  .string()
  .min(8, "A senha precisa ter pelo menos 8 caracteres")
  .max(128)
  .regex(/[A-Za-z]/, "Inclua ao menos uma letra")
  .regex(/\d/, "Inclua ao menos um número");

const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[^\d+]/g, ""))
  .refine((v) => v.replace(/\D/g, "").length >= 10 && v.replace(/\D/g, "").length <= 13, "Telefone inválido (inclua o DDD)");

const emailSchema = z.string().trim().toLowerCase().email("E-mail inválido").max(160);
const nameSchema = z.string().trim().min(2, "Informe o nome").max(100);

export const clientRegistrationSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, { errorMap: () => ({ message: "É preciso aceitar os termos e a política de privacidade" }) }),
    notifyWhatsapp: z.boolean().optional().default(false),
  })
  .refine((d) => d.password === d.confirmPassword, { message: "As senhas não conferem", path: ["confirmPassword"] });

export const specialtiesSchema = z
  .array(z.string().trim().min(2).max(40))
  .min(1, "Informe ao menos uma especialidade")
  .max(12);

export const barberRegistrationSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    displayName: z.string().trim().min(2, "Informe o nome profissional").max(60),
    photoUrl: z.string().max(300).optional().nullable(),
    bio: z.string().trim().min(20, "Escreva uma biografia com pelo menos 20 caracteres").max(800),
    specialties: specialtiesSchema,
    experience: z.string().trim().max(800).optional().default(""),
    message: z.string().trim().max(500).optional().default(""),
    acceptTerms: z.literal(true, { errorMap: () => ({ message: "É preciso aceitar os termos e a política de privacidade" }) }),
  })
  .refine((d) => d.password === d.confirmPassword, { message: "As senhas não conferem", path: ["confirmPassword"] });

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function ensureRole(tx: Tx, userId: string, shopId: string, role: Role, grantedById?: string) {
  await tx.roleAssignment.upsert({
    where: { userId_shopId_role: { userId, shopId, role } },
    create: { userId, shopId, role, grantedById },
    update: {},
  });
}

async function createUser(tx: Tx, data: { name: string; email: string; phone: string; password: string; notifyWhatsapp?: boolean }) {
  try {
    return await tx.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        passwordHash: await hashPassword(data.password),
        notifyWhatsapp: data.notifyWhatsapp ?? false,
        acceptedTermsAt: new Date(),
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new DomainError("Já existe uma conta com este e-mail. Entre com sua senha ou recupere o acesso.");
    throw err;
  }
}

// ─── Cadastro ────────────────────────────────────────────────────────────────

export async function registerClient(shopId: string, raw: unknown) {
  const input = clientRegistrationSchema.parse(raw);
  return prisma.$transaction(async (tx) => {
    const user = await createUser(tx, input);
    await ensureRole(tx, user.id, shopId, "CLIENT");
    await tx.clientProfile.create({ data: { userId: user.id, shopId } });
    await notify({ userId: user.id, type: "ACCOUNT_CREATED", title: "Bem-vindo à barbearia", body: "Sua conta foi criada. Explore a barbearia 3D e agende seu horário.", link: "/barbearia" }, tx);
    return user;
  });
}

/**
 * Cadastro "Sou Barbeiro": cria a conta (com acesso de cliente) e uma
 * solicitação de parceria PENDENTE. O papel BARBER só é concedido pelo
 * proprietário em approvePartner().
 */
export async function registerBarber(shopId: string, raw: unknown) {
  const input = barberRegistrationSchema.parse(raw);
  return prisma.$transaction(async (tx) => {
    const user = await createUser(tx, input);
    await ensureRole(tx, user.id, shopId, "CLIENT");
    await tx.clientProfile.create({ data: { userId: user.id, shopId } });
    const profile = await tx.barberProfile.create({
      data: {
        shopId,
        userId: user.id,
        displayName: input.displayName,
        photoUrl: input.photoUrl ?? null,
        bio: input.bio,
        specialties: JSON.stringify(input.specialties),
        experience: input.experience,
        status: "PENDING",
      },
    });
    const request = await tx.partnerRequest.create({ data: { shopId, barberProfileId: profile.id, message: input.message } });
    await notify({ userId: user.id, type: "PARTNER_REQUEST_SENT", title: "Solicitação enviada", body: "Seu cadastro está aguardando aprovação do proprietário.", link: "/barbeiro/aguardando" }, tx);
    await notifyAdmins(shopId, { type: "PARTNER_REQUEST_RECEIVED", title: "Nova solicitação de parceria", body: `${input.displayName} quer fazer parte da equipe.`, link: "/admin/solicitacoes", dedupeKey: `partner-req:${request.id}` }, tx);
    return { user, profile, request };
  });
}

/** Usuário já autenticado (ex.: cliente) solicita participação como barbeiro */
export async function requestPartnership(actor: Actor, raw: unknown) {
  const input = z
    .object({
      displayName: z.string().trim().min(2).max(60),
      bio: z.string().trim().min(20, "Escreva uma biografia com pelo menos 20 caracteres").max(800),
      specialties: specialtiesSchema,
      experience: z.string().trim().max(800).optional().default(""),
      photoUrl: z.string().max(300).optional().nullable(),
      message: z.string().trim().max(500).optional().default(""),
    })
    .parse(raw);
  const existing = await prisma.barberProfile.findFirst({ where: { userId: actor.userId, shopId: actor.shopId } });
  return prisma.$transaction(async (tx) => {
    let profile;
    if (existing) {
      if (["APPROVED", "PENDING"].includes(existing.status)) throw new DomainError("Você já possui uma solicitação ou perfil profissional ativo.");
      profile = await tx.barberProfile.update({
        where: { id: existing.id },
        data: { displayName: input.displayName, bio: input.bio, specialties: JSON.stringify(input.specialties), experience: input.experience, photoUrl: input.photoUrl ?? existing.photoUrl, status: "PENDING" },
      });
    } else {
      profile = await tx.barberProfile.create({
        data: { shopId: actor.shopId, userId: actor.userId, displayName: input.displayName, bio: input.bio, specialties: JSON.stringify(input.specialties), experience: input.experience, photoUrl: input.photoUrl ?? null, status: "PENDING" },
      });
    }
    const request = await tx.partnerRequest.create({ data: { shopId: actor.shopId, barberProfileId: profile.id, message: input.message } });
    await notifyAdmins(actor.shopId, { type: "PARTNER_REQUEST_RECEIVED", title: "Nova solicitação de parceria", body: `${input.displayName} quer fazer parte da equipe.`, link: "/admin/solicitacoes", dedupeKey: `partner-req:${request.id}` }, tx);
    return profile;
  });
}

/** Barbeiro com complementação solicitada atualiza dados e reenvia */
export async function resubmitPartnerRequest(actor: Actor, raw: unknown) {
  const input = z
    .object({
      displayName: z.string().trim().min(2).max(60),
      bio: z.string().trim().min(20).max(800),
      specialties: specialtiesSchema,
      experience: z.string().trim().max(800).optional().default(""),
      photoUrl: z.string().max(300).optional().nullable(),
      message: z.string().trim().max(500).optional().default(""),
    })
    .parse(raw);
  const profile = await prisma.barberProfile.findFirst({ where: { userId: actor.userId, shopId: actor.shopId } });
  if (!profile || profile.status !== "NEEDS_INFO") throw new DomainError("Não há complementação pendente.");
  await prisma.$transaction(async (tx) => {
    await tx.barberProfile.update({
      where: { id: profile.id },
      data: { displayName: input.displayName, bio: input.bio, specialties: JSON.stringify(input.specialties), experience: input.experience, photoUrl: input.photoUrl ?? profile.photoUrl, status: "PENDING" },
    });
    await tx.partnerRequest.updateMany({ where: { barberProfileId: profile.id, status: "NEEDS_INFO" }, data: { status: "PENDING", message: input.message } });
    await notifyAdmins(actor.shopId, { type: "PARTNER_REQUEST_RECEIVED", title: "Solicitação complementada", body: `${input.displayName} enviou os dados solicitados.`, link: "/admin/solicitacoes" }, tx);
  });
}

// ─── Autenticação ────────────────────────────────────────────────────────────

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, "Informe a senha").max(128) });

/** Retorna o usuário se as credenciais forem válidas. Mensagem genérica em falhas. */
export async function authenticate(shopId: string, raw: unknown) {
  const input = loginSchema.parse(raw);
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  // Executa comparação mesmo sem usuário para reduzir enumeração por tempo
  const ok = await verifyPassword(input.password, user?.passwordHash ?? "$2a$12$CwTycUXWue0Thq9StjUM0uJ8.7Z5b3WlZ3i5C0cR0Zr4Z7eYQ5x2e");
  if (!user || !ok || user.anonymizedAt) throw new DomainError("E-mail ou senha incorretos.", "UNAUTHENTICATED");
  const roles = await prisma.roleAssignment.findMany({ where: { userId: user.id, shopId } });
  if (roles.length === 0) {
    // Conta existe (ex.: outra unidade) mas não tem vínculo com esta barbearia → vira cliente
    await prisma.roleAssignment.create({ data: { userId: user.id, shopId, role: "CLIENT" } });
    await prisma.clientProfile.upsert({ where: { userId_shopId: { userId: user.id, shopId } }, create: { userId: user.id, shopId }, update: {} });
    return { user, roles: ["CLIENT"] as Role[] };
  }
  return { user, roles: roles.map((r) => r.role as Role) };
}

/** Papel inicial após login, respeitando a escolha feita na tela inicial */
export function pickActiveRole(roles: Role[], preferred?: string | null): Role {
  if (preferred && roles.includes(preferred as Role)) return preferred as Role;
  if (roles.includes("ADMIN")) return "ADMIN";
  if (roles.includes("BARBER")) return "BARBER";
  return "CLIENT";
}

export async function switchRole(actor: Actor, sessionId: string, role: Role) {
  if (!actor.roles.includes(role)) throw forbidden("Você não possui este perfil.");
  if (role === "BARBER" && !actor.barberProfileId) throw forbidden("Seu perfil profissional ainda não foi aprovado.");
  await prisma.session.update({ where: { id: sessionId }, data: { activeRole: role } });
}

// ─── Recuperação de senha ────────────────────────────────────────────────────

export async function requestPasswordReset(email: string) {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return null;
  const user = await prisma.user.findUnique({ where: { email: parsed.data } });
  if (!user || user.anonymizedAt) return null; // resposta idêntica para não revelar contas
  const token = newToken();
  await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 60 * 60000) } });
  const link = `/redefinir-senha/${token}`;
  await notify({ userId: user.id, type: "PASSWORD_RESET", title: "Redefinição de senha", body: "Recebemos um pedido para redefinir sua senha. O link expira em 1 hora. Se não foi você, ignore esta mensagem.", link, essentialEmail: true, skipInApp: true });
  return { token, link };
}

export async function resetPassword(token: string, password: string, confirm: string) {
  passwordSchema.parse(password);
  if (password !== confirm) throw new DomainError("As senhas não conferem.");
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) throw new DomainError("Link inválido ou expirado. Solicite um novo.");
  await prisma.$transaction(async (tx) => {
    const used = await tx.passwordResetToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
    if (used.count === 0) throw new DomainError("Link já utilizado.");
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash: await hashPassword(password) } });
    await tx.session.deleteMany({ where: { userId: row.userId } }); // encerra sessões antigas
  });
}

export async function changePassword(actor: Actor, current: string, next: string, confirm: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.userId } });
  if (!(await verifyPassword(current, user.passwordHash))) throw new DomainError("Senha atual incorreta.");
  passwordSchema.parse(next);
  if (next !== confirm) throw new DomainError("As senhas não conferem.");
  await prisma.user.update({ where: { id: actor.userId }, data: { passwordHash: await hashPassword(next) } });
}

// ─── Perfil ──────────────────────────────────────────────────────────────────

export const profileSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  email: emailSchema,
  notifyEmail: z.boolean(),
  notifyWhatsapp: z.boolean(),
  preferences: z.string().trim().max(500).optional().default(""),
  sharePreferences: z.boolean().optional().default(true),
});

export async function updateProfile(actor: Actor, raw: unknown) {
  const input = profileSchema.parse(raw);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: actor.userId }, data: { name: input.name, phone: input.phone, email: input.email, notifyEmail: input.notifyEmail, notifyWhatsapp: input.notifyWhatsapp } });
      await tx.clientProfile.upsert({
        where: { userId_shopId: { userId: actor.userId, shopId: actor.shopId } },
        create: { userId: actor.userId, shopId: actor.shopId, preferences: input.preferences, sharePreferences: input.sharePreferences },
        update: { preferences: input.preferences, sharePreferences: input.sharePreferences },
      });
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new DomainError("Este e-mail já está em uso por outra conta.");
    throw err;
  }
}

/** LGPD: exportação dos dados do titular */
export async function exportMyData(actor: Actor) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: actor.userId },
    select: {
      name: true, email: true, phone: true, createdAt: true, notifyEmail: true, notifyWhatsapp: true, acceptedTermsAt: true,
      clientProfiles: { select: { preferences: true, sharePreferences: true } },
      appointments: { select: { startsAt: true, status: true, priceCents: true, service: { select: { name: true } }, barber: { select: { displayName: true } } } },
      favorites: { select: { barber: { select: { displayName: true } } } },
      notifications: { select: { title: true, body: true, createdAt: true } },
    },
  });
  return user;
}

/**
 * LGPD: exclusão da conta. Dados pessoais são anonimizados; registros de
 * atendimentos e financeiros são preservados (obrigação legal/contábil).
 */
export async function anonymizeAccount(actor: Actor, password: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.userId } });
  if (!(await verifyPassword(password, user.passwordHash))) throw new DomainError("Senha incorreta.");
  if (actor.roles.includes("ADMIN")) throw new DomainError("O proprietário não pode excluir a própria conta pelo painel. Transfira a administração antes.");
  const future = await prisma.appointment.count({ where: { clientUserId: actor.userId, status: { in: ["PENDING", "CONFIRMED"] }, startsAt: { gt: new Date() } } });
  if (future > 0) throw new DomainError("Cancele seus agendamentos futuros antes de excluir a conta.");
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: actor.userId },
      data: { name: "Titular removido", email: `removido+${actor.userId}@anon.invalid`, phone: "", passwordHash: "!", anonymizedAt: new Date(), notifyEmail: false, notifyWhatsapp: false },
    });
    await tx.clientProfile.updateMany({ where: { userId: actor.userId }, data: { preferences: "" } });
    await tx.favorite.deleteMany({ where: { userId: actor.userId } });
    await tx.session.deleteMany({ where: { userId: actor.userId } });
    await audit({ shopId: actor.shopId, actorUserId: actor.userId, action: "ACCOUNT_ANONYMIZED", entity: "User", entityId: actor.userId }, tx);
  });
}

// ─── Aprovação de parceiros (somente proprietário) ───────────────────────────

export const approvalSchema = z.object({
  barberProfileId: z.string().min(1),
  commissionModel: z.enum(["PERCENT", "PER_SERVICE", "FIXED"]).default("PERCENT"),
  commissionPercent: z.coerce.number().int().min(0).max(100).default(50),
  fixedFeeCents: z.coerce.number().int().min(0).default(0),
  partnershipType: z.string().trim().max(40).default("COMISSIONADO"),
  stationId: z.string().optional().nullable(),
  serviceIds: z.array(z.string()).default([]),
  copyHoursFromShop: z.boolean().default(true),
});

export async function approvePartner(actor: Actor, raw: unknown) {
  assertAdmin(actor);
  const input = approvalSchema.parse(raw);
  const profile = await prisma.barberProfile.findFirst({ where: { id: input.barberProfileId, shopId: actor.shopId } });
  if (!profile || !profile.userId) throw notFound("Solicitação não encontrada.");
  if (profile.status === "APPROVED") throw new DomainError("Este profissional já está aprovado.");
  const userId = profile.userId;

  await prisma.$transaction(async (tx) => {
    await tx.barberProfile.update({
      where: { id: profile.id },
      data: {
        status: "APPROVED",
        commissionModel: input.commissionModel,
        commissionPercent: input.commissionPercent,
        fixedFeeCents: input.fixedFeeCents,
        partnershipType: input.partnershipType,
        approvedAt: new Date(),
        approvedById: actor.userId,
      },
    });
    await ensureRole(tx, userId, actor.shopId, "BARBER", actor.userId);
    await tx.partnerRequest.updateMany({
      where: { barberProfileId: profile.id, status: { in: ["PENDING", "NEEDS_INFO"] } },
      data: { status: "APPROVED", reviewedById: actor.userId, reviewedAt: new Date() },
    });
    await setupBarberDefaults(tx, actor.shopId, profile.id, input.serviceIds, input.copyHoursFromShop);
    if (input.stationId) await assignStationDraftAndPublish(tx, actor.shopId, input.stationId, profile.id);
    await notify({ userId, type: "PARTNER_APPROVED", title: "Você agora faz parte da equipe!", body: "Seu cadastro foi aprovado. Acesse o painel profissional para conferir sua agenda.", link: "/barbeiro", dedupeKey: `partner-approved:${profile.id}:${Date.now()}` }, tx);
    await audit({ shopId: actor.shopId, actorUserId: actor.userId, action: "PARTNER_APPROVED", entity: "BarberProfile", entityId: profile.id, data: input }, tx);
  });
}

/** Habilita serviços e copia o horário da barbearia como jornada inicial */
export async function setupBarberDefaults(tx: Tx, shopId: string, barberProfileId: string, serviceIds: string[], copyHours: boolean) {
  const services = serviceIds.length
    ? await tx.service.findMany({ where: { shopId, id: { in: serviceIds } } })
    : await tx.service.findMany({ where: { shopId, active: true } });
  for (const s of services) {
    await tx.barberService.upsert({
      where: { barberProfileId_serviceId: { barberProfileId, serviceId: s.id } },
      create: { barberProfileId, serviceId: s.id },
      update: { active: true },
    });
  }
  if (copyHours) {
    const existing = await tx.workingHours.count({ where: { barberProfileId } });
    if (existing === 0) {
      const hours = await tx.shopHours.findMany({ where: { shopId, closed: false } });
      for (const h of hours) {
        await tx.workingHours.create({
          data: { barberProfileId, weekday: h.weekday, startMin: h.openMin, endMin: h.closeMin, breakStartMin: 12 * 60, breakEndMin: 13 * 60 },
        });
      }
    }
  }
}

/** Atribuição direta (usada na aprovação): vincula e publica a estação */
async function assignStationDraftAndPublish(tx: Tx, shopId: string, stationId: string, barberProfileId: string) {
  const station = await tx.station.findFirst({ where: { id: stationId, shopId } });
  if (!station) throw notFound("Estação não encontrada.");
  if (station.barberProfileId && station.barberProfileId !== barberProfileId) throw new DomainError("Esta estação já possui um profissional. Escolha outra ou libere-a no editor 3D.");
  await tx.station.updateMany({ where: { barberProfileId }, data: { barberProfileId: null } });
  await tx.station.update({ where: { id: stationId }, data: { barberProfileId, active: true, isPublished: true, draftJson: null } });
}

export async function rejectPartner(actor: Actor, barberProfileId: string, note: string) {
  assertAdmin(actor);
  const profile = await prisma.barberProfile.findFirst({ where: { id: barberProfileId, shopId: actor.shopId } });
  if (!profile || !profile.userId) throw notFound("Solicitação não encontrada.");
  if (profile.status === "APPROVED") throw new DomainError("Use o desligamento para profissionais ativos.");
  await prisma.$transaction(async (tx) => {
    await tx.barberProfile.update({ where: { id: profile.id }, data: { status: "REJECTED", adminNote: note } });
    await tx.partnerRequest.updateMany({ where: { barberProfileId, status: { in: ["PENDING", "NEEDS_INFO"] } }, data: { status: "REJECTED", reviewerNote: note, reviewedById: actor.userId, reviewedAt: new Date() } });
    await notify({ userId: profile.userId!, type: "PARTNER_REJECTED", title: "Solicitação não aprovada", body: note ? `Sua solicitação não foi aprovada: ${note}` : "Sua solicitação de parceria não foi aprovada neste momento.", link: "/barbeiro/aguardando" }, tx);
    await audit({ shopId: actor.shopId, actorUserId: actor.userId, action: "PARTNER_REJECTED", entity: "BarberProfile", entityId: profile.id, data: { note } }, tx);
  });
}

export async function requestPartnerInfo(actor: Actor, barberProfileId: string, note: string) {
  assertAdmin(actor);
  if (note.trim().length < 5) throw new DomainError("Descreva quais informações o candidato deve complementar.");
  const profile = await prisma.barberProfile.findFirst({ where: { id: barberProfileId, shopId: actor.shopId } });
  if (!profile || !profile.userId || profile.status !== "PENDING") throw notFound("Solicitação pendente não encontrada.");
  await prisma.$transaction(async (tx) => {
    await tx.barberProfile.update({ where: { id: profile.id }, data: { status: "NEEDS_INFO", adminNote: note } });
    await tx.partnerRequest.updateMany({ where: { barberProfileId, status: "PENDING" }, data: { status: "NEEDS_INFO", reviewerNote: note, reviewedById: actor.userId, reviewedAt: new Date() } });
    await notify({ userId: profile.userId!, type: "PARTNER_NEEDS_INFO", title: "Complementação de dados", body: note, link: "/barbeiro/aguardando" }, tx);
  });
}

// ─── Convites ────────────────────────────────────────────────────────────────

export const inviteBarberSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: z.string().trim().max(20).optional().default(""),
  displayName: z.string().trim().min(2).max(60),
  photoUrl: z.string().max(300).optional().nullable(),
  bio: z.string().trim().max(800).default(""),
  specialties: z.array(z.string().trim().min(2).max(40)).max(12).default([]),
  commissionModel: z.enum(["PERCENT", "PER_SERVICE", "FIXED"]).default("PERCENT"),
  commissionPercent: z.coerce.number().int().min(0).max(100).default(50),
  fixedFeeCents: z.coerce.number().int().min(0).default(0),
  partnershipType: z.string().trim().max(40).default("COMISSIONADO"),
  stationId: z.string().optional().nullable(),
  services: z
    .array(z.object({ serviceId: z.string(), priceCents: z.number().int().min(0).nullable().optional(), durationMin: z.number().int().min(5).max(480).nullable().optional() }))
    .default([]),
  hours: z
    .array(z.object({ weekday: z.number().int().min(0).max(6), startMin: z.number().int(), endMin: z.number().int(), breakStartMin: z.number().int().nullable().optional(), breakEndMin: z.number().int().nullable().optional() }))
    .default([]),
});

/**
 * "+ Adicionar Barbeiro": cria o perfil profissional já configurado
 * (serviços, preços, jornada, comissão, estação) e um convite para que o
 * profissional conclua o cadastro definindo sua senha.
 */
export async function inviteBarber(actor: Actor, raw: unknown) {
  assertAdmin(actor);
  const input = inviteBarberSchema.parse(raw);
  const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
  if (existingUser) {
    const prof = await prisma.barberProfile.findFirst({ where: { userId: existingUser.id, shopId: actor.shopId } });
    if (prof && ["APPROVED", "INVITED"].includes(prof.status)) throw new DomainError("Este e-mail já pertence a um profissional da equipe.");
  }
  const token = newToken();
  const result = await prisma.$transaction(async (tx) => {
    const profile = await tx.barberProfile.create({
      data: {
        shopId: actor.shopId,
        displayName: input.displayName,
        photoUrl: input.photoUrl ?? null,
        bio: input.bio,
        specialties: JSON.stringify(input.specialties),
        status: "INVITED",
        commissionModel: input.commissionModel,
        commissionPercent: input.commissionPercent,
        fixedFeeCents: input.fixedFeeCents,
        partnershipType: input.partnershipType,
        adminNote: JSON.stringify({ inviteName: input.name, invitePhone: input.phone }),
      },
    });
    for (const s of input.services) {
      const svc = await tx.service.findFirst({ where: { id: s.serviceId, shopId: actor.shopId } });
      if (!svc) continue;
      await tx.barberService.create({ data: { barberProfileId: profile.id, serviceId: s.serviceId, priceCents: s.priceCents ?? null, durationMin: s.durationMin ?? null } });
    }
    if (input.hours.length) {
      for (const h of input.hours) {
        if (h.endMin <= h.startMin) throw new DomainError("Horário de trabalho inválido.");
        await tx.workingHours.create({ data: { barberProfileId: profile.id, ...h, breakStartMin: h.breakStartMin ?? null, breakEndMin: h.breakEndMin ?? null } });
      }
    } else {
      await setupBarberDefaults(tx, actor.shopId, profile.id, input.services.length ? input.services.map((s) => s.serviceId) : [], true);
    }
    if (input.stationId) {
      const station = await tx.station.findFirst({ where: { id: input.stationId, shopId: actor.shopId } });
      if (!station) throw notFound("Estação não encontrada.");
      if (station.barberProfileId) throw new DomainError("Esta estação já possui um profissional.");
      await tx.station.update({ where: { id: station.id }, data: { barberProfileId: profile.id } });
    }
    const invite = await tx.invite.create({
      data: { shopId: actor.shopId, email: input.email, tokenHash: hashToken(token), barberProfileId: profile.id, createdById: actor.userId, expiresAt: new Date(Date.now() + 7 * 86400000) },
    });
    if (existingUser) {
      await notify({ userId: existingUser.id, type: "INVITE_RECEIVED", title: "Convite para a equipe", body: `Você foi convidado para atuar como ${input.displayName}.`, link: `/convite/${token}` }, tx);
    }
    await audit({ shopId: actor.shopId, actorUserId: actor.userId, action: "BARBER_INVITED", entity: "BarberProfile", entityId: profile.id, data: { email: input.email } }, tx);
    return { profile, invite };
  });
  return { ...result, token, link: `/convite/${token}` };
}

export async function getInvite(token: string) {
  const invite = await prisma.invite.findUnique({ where: { tokenHash: hashToken(token) }, include: { barber: true, shop: true } });
  if (!invite || invite.acceptedAt || invite.revokedAt || invite.expiresAt < new Date()) return null;
  return invite;
}

export const acceptInviteSchema = z
  .object({ name: nameSchema, phone: phoneSchema, password: passwordSchema, confirmPassword: z.string(), acceptTerms: z.literal(true, { errorMap: () => ({ message: "É preciso aceitar os termos" }) }) })
  .refine((d) => d.password === d.confirmPassword, { message: "As senhas não conferem", path: ["confirmPassword"] });

/** Aceite do convite: cria (ou vincula) a conta e ativa o perfil profissional */
export async function acceptInvite(token: string, raw: unknown, existingUserId?: string) {
  const invite = await getInvite(token);
  if (!invite) throw new DomainError("Convite inválido, expirado ou já utilizado.");
  return prisma.$transaction(async (tx) => {
    let userId: string;
    if (existingUserId) {
      const u = await tx.user.findUniqueOrThrow({ where: { id: existingUserId } });
      if (u.email !== invite.email) throw forbidden("Este convite foi enviado para outro e-mail.");
      userId = u.id;
    } else {
      const input = acceptInviteSchema.parse(raw);
      const exists = await tx.user.findUnique({ where: { email: invite.email } });
      if (exists) throw new DomainError("Já existe uma conta com este e-mail. Entre com ela e abra o link do convite novamente.");
      const user = await createUser(tx, { name: input.name, email: invite.email, phone: input.phone, password: input.password });
      userId = user.id;
    }
    const used = await tx.invite.updateMany({ where: { id: invite.id, acceptedAt: null }, data: { acceptedAt: new Date() } });
    if (used.count === 0) throw new DomainError("Convite já utilizado.");
    await tx.barberProfile.update({ where: { id: invite.barberProfileId }, data: { userId, status: "APPROVED", approvedAt: new Date(), approvedById: invite.createdById } });
    await ensureRole(tx, userId, invite.shopId, "CLIENT");
    await ensureRole(tx, userId, invite.shopId, "BARBER", invite.createdById);
    await tx.clientProfile.upsert({ where: { userId_shopId: { userId, shopId: invite.shopId } }, create: { userId, shopId: invite.shopId }, update: {} });
    // Estação vinculada no convite passa a valer publicamente
    await tx.station.updateMany({ where: { barberProfileId: invite.barberProfileId, isPublished: true }, data: { active: true } });
    await notifyAdmins(invite.shopId, { type: "PARTNER_APPROVED", title: "Convite aceito", body: `${invite.barber.displayName} concluiu o cadastro e já está na equipe.`, link: "/admin/equipe" }, tx);
    await audit({ shopId: invite.shopId, actorUserId: userId, action: "INVITE_ACCEPTED", entity: "BarberProfile", entityId: invite.barberProfileId }, tx);
    return { userId };
  });
}

export async function revokeInvite(actor: Actor, inviteId: string) {
  assertAdmin(actor);
  await prisma.invite.updateMany({ where: { id: inviteId, shopId: actor.shopId, acceptedAt: null }, data: { revokedAt: new Date() } });
}

/** Gera novo link para um perfil INVITED (o anterior é revogado) */
export async function regenerateInvite(actor: Actor, barberProfileId: string) {
  assertAdmin(actor);
  const profile = await prisma.barberProfile.findFirst({ where: { id: barberProfileId, shopId: actor.shopId, status: "INVITED" }, include: { invites: { orderBy: { createdAt: "desc" }, take: 1 } } });
  if (!profile || !profile.invites[0]) throw notFound("Convite não encontrado.");
  const token = newToken();
  await prisma.$transaction([
    prisma.invite.updateMany({ where: { barberProfileId, acceptedAt: null }, data: { revokedAt: new Date() } }),
    prisma.invite.create({ data: { shopId: actor.shopId, email: profile.invites[0].email, tokenHash: hashToken(token), barberProfileId, createdById: actor.userId, expiresAt: new Date(Date.now() + 7 * 86400000) } }),
  ]);
  return `/convite/${token}`;
}

// ─── Bootstrap do estabelecimento (primeiro proprietário) ────────────────────

export const bootstrapSchema = z.object({
  shopName: z.string().trim().min(2).max(80),
  ownerName: nameSchema,
  ownerEmail: emailSchema,
  ownerPhone: phoneSchema,
  ownerPassword: passwordSchema,
  ownerDisplayName: z.string().trim().min(2).max(60),
  ownerIsBarber: z.boolean().default(true),
});

const DEFAULT_SERVICES: Array<{ name: string; description: string; priceCents: number; durationMin: number; category: string }> = [
  { name: "Corte masculino", description: "Corte clássico com acabamento na máquina e tesoura.", priceCents: 5000, durationMin: 40, category: "Cabelo" },
  { name: "Corte degradê", description: "Degradê navalhado com transição suave.", priceCents: 6000, durationMin: 45, category: "Cabelo" },
  { name: "Corte na tesoura", description: "Corte inteiramente na tesoura para cabelos médios e longos.", priceCents: 6500, durationMin: 50, category: "Cabelo" },
  { name: "Barba tradicional", description: "Toalha quente, navalha e balm hidratante.", priceCents: 4000, durationMin: 30, category: "Barba" },
  { name: "Corte + barba", description: "Combo completo de corte e barba tradicional.", priceCents: 8500, durationMin: 70, category: "Combos" },
  { name: "Sobrancelha", description: "Design e limpeza de sobrancelha na navalha.", priceCents: 2000, durationMin: 15, category: "Acabamento" },
  { name: "Pigmentação", description: "Pigmentação de barba ou cabelo para preencher falhas.", priceCents: 4500, durationMin: 30, category: "Acabamento" },
  { name: "Acabamento", description: "Pezinho e contornos entre cortes.", priceCents: 2500, durationMin: 15, category: "Acabamento" },
];

export async function countAdmins() {
  return prisma.roleAssignment.count({ where: { role: "ADMIN" } });
}

/**
 * Cria o estabelecimento com configuração padrão, o primeiro proprietário e
 * — obrigatoriamente — um barbeiro inicial, uma cadeira e uma agenda.
 * Executa uma única vez: falha se já houver administrador.
 */
export async function bootstrapShop(slug: string, raw: unknown) {
  const input = bootstrapSchema.parse(raw);
  if ((await countAdmins()) > 0) throw forbidden("A configuração inicial já foi concluída.");
  return prisma.$transaction(async (tx) => {
    const shop = await tx.shop.create({
      data: {
        slug,
        name: input.shopName,
        tagline: "Barbearia premium",
        description: "Tradição, precisão e um ambiente pensado para você.",
        cancellationPolicyText: "Cancelamentos e remarcações pelo site podem ser feitos até 2 horas antes do horário agendado.",
      },
    });
    // Seg–Sex 09:00–20:00, Sáb 09:00–18:00, Dom fechado
    for (let weekday = 0; weekday < 7; weekday++) {
      await tx.shopHours.create({
        data: { shopId: shop.id, weekday, openMin: 9 * 60, closeMin: weekday === 6 ? 18 * 60 : 20 * 60, closed: weekday === 0 },
      });
    }
    const categories = new Map<string, string>();
    let order = 0;
    for (const s of DEFAULT_SERVICES) {
      if (!categories.has(s.category)) {
        const c = await tx.serviceCategory.create({ data: { shopId: shop.id, name: s.category, sortOrder: categories.size } });
        categories.set(s.category, c.id);
      }
      await tx.service.create({ data: { shopId: shop.id, categoryId: categories.get(s.category), name: s.name, description: s.description, priceCents: s.priceCents, durationMin: s.durationMin, sortOrder: order++ } });
    }
    const owner = await createUser(tx, { name: input.ownerName, email: input.ownerEmail, phone: input.ownerPhone, password: input.ownerPassword });
    await ensureRole(tx, owner.id, shop.id, "ADMIN");
    await ensureRole(tx, owner.id, shop.id, "CLIENT");
    await tx.clientProfile.create({ data: { userId: owner.id, shopId: shop.id } });

    const station = await tx.station.create({
      data: { shopId: shop.id, name: "Estação 01", spotKey: "A1", rotationY: 0, model: "classic", isPublished: true, active: true },
    });
    if (input.ownerIsBarber) {
      const profile = await tx.barberProfile.create({
        data: {
          shopId: shop.id,
          userId: owner.id,
          displayName: input.ownerDisplayName,
          bio: "Fundador da casa. Especialista em cortes clássicos e barba na navalha.",
          specialties: JSON.stringify(["Corte clássico", "Degradê", "Barba na navalha"]),
          status: "APPROVED",
          commissionModel: "PERCENT",
          commissionPercent: 100,
          partnershipType: "PROPRIETARIO",
          approvedAt: new Date(),
          approvedById: owner.id,
        },
      });
      await ensureRole(tx, owner.id, shop.id, "BARBER", owner.id);
      await setupBarberDefaults(tx, shop.id, profile.id, [], true);
      await tx.station.update({ where: { id: station.id }, data: { barberProfileId: profile.id } });
    }
    await tx.sceneConfig.create({
      data: { shopId: shop.id, publishedJson: JSON.stringify({ signText: input.shopName, accentColor: "#c8a165", plants: true, sofaColor: "#5a3b2a", neon: true }), publishedAt: new Date() },
    });
    await audit({ shopId: shop.id, actorUserId: owner.id, action: "SHOP_BOOTSTRAPPED", entity: "Shop", entityId: shop.id }, tx);
    return { shop, owner };
  });
}
