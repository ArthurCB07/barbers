"use server";

/**
 * Server Actions das áreas de Cliente, Barbeiro e Proprietário.
 * Cada ação resolve o Actor a partir da sessão e delega à camada de serviços,
 * que verifica permissões no servidor.
 */
import { revalidatePath } from "next/cache";
import { authed } from "../action-utils";
import { rateLimit } from "../rate-limit";
import { prisma } from "../db";
import { DomainError, notFound } from "../errors";
import { assertAdmin } from "../actor";
import { destroySession } from "../auth/session";
import * as appts from "../services/appointments";
import * as accounts from "../services/accounts";
import * as team from "../services/team";
import * as catalog from "../services/catalog";
import * as scene from "../services/scene";
import * as finance from "../services/finance";
import { audit } from "../audit";
import type { AppointmentStatus } from "@/types/domain";

const refreshAll = () => revalidatePath("/", "layout");

// ─── Agendamentos ────────────────────────────────────────────────────────────

export async function createAppointmentAction(input: unknown) {
  return authed(async (s) => {
    await rateLimit(`book:${s.user.id}`, 15, 10 * 60);
    const a = await appts.createAppointment(s.actor, input as never);
    refreshAll();
    return { id: a.id, status: a.status };
  }, "Agendamento realizado!");
}

export async function cancelAppointmentAction(id: string, reason = "") {
  return authed(async (s) => {
    await appts.cancelAppointment(s.actor, id, reason);
    refreshAll();
  }, "Agendamento cancelado.");
}

export async function rescheduleAppointmentAction(id: string, input: unknown) {
  return authed(async (s) => {
    await appts.rescheduleAppointment(s.actor, id, input as never);
    refreshAll();
  }, "Agendamento remarcado.");
}

export async function changeStatusAction(id: string, to: AppointmentStatus, note = "") {
  return authed(async (s) => {
    await appts.changeAppointmentStatus(s.actor, id, to, note);
    refreshAll();
  }, "Estado atualizado.");
}

// ─── Cliente ─────────────────────────────────────────────────────────────────

export async function updateProfileAction(input: unknown) {
  return authed(async (s) => {
    await accounts.updateProfile(s.actor, input);
    refreshAll();
  }, "Perfil atualizado.");
}

export async function changePasswordAction(current: string, next: string, confirm: string) {
  return authed(async (s) => {
    await rateLimit(`pwd:${s.user.id}`, 5, 15 * 60);
    await accounts.changePassword(s.actor, current, next, confirm);
  }, "Senha alterada.");
}

export async function toggleFavoriteAction(barberProfileId: string) {
  return authed(async (s) => {
    const barber = await prisma.barberProfile.findFirst({ where: { id: barberProfileId, shopId: s.actor.shopId, status: "APPROVED" } });
    if (!barber) throw notFound("Profissional não encontrado.");
    const existing = await prisma.favorite.findUnique({ where: { userId_barberProfileId: { userId: s.user.id, barberProfileId } } });
    if (existing) await prisma.favorite.delete({ where: { id: existing.id } });
    else await prisma.favorite.create({ data: { userId: s.user.id, barberProfileId } });
    refreshAll();
    return { favorite: !existing };
  });
}

export async function markNotificationsReadAction(ids?: string[]) {
  return authed(async (s) => {
    await prisma.notification.updateMany({ where: { userId: s.user.id, readAt: null, ...(ids ? { id: { in: ids } } : {}) }, data: { readAt: new Date() } });
    refreshAll();
  });
}

export async function deleteAccountAction(password: string) {
  return authed(async (s) => {
    await rateLimit(`delete:${s.user.id}`, 5, 15 * 60);
    await accounts.anonymizeAccount(s.actor, password);
    await destroySession();
    return { redirectTo: "/" };
  }, "Conta excluída. Seus dados pessoais foram anonimizados.");
}

// ─── Barbeiro ────────────────────────────────────────────────────────────────

export async function updateWorkingHoursAction(barberProfileId: string, days: unknown) {
  return authed(async (s) => {
    await team.updateWorkingHours(s.actor, barberProfileId, days);
    refreshAll();
  }, "Jornada salva.");
}

export async function createTimeOffAction(input: unknown) {
  return authed(async (s) => {
    const r = await team.createTimeOff(s.actor, input);
    refreshAll();
    return { status: r.timeOff.status, conflicts: r.conflicts };
  });
}

export async function deleteTimeOffAction(id: string) {
  return authed(async (s) => {
    await team.deleteTimeOff(s.actor, id);
    refreshAll();
  }, "Período removido.");
}

export async function updateBarberProfileAction(barberProfileId: string, input: unknown) {
  return authed(async (s) => {
    await team.updateBarberPublicProfile(s.actor, barberProfileId, input);
    refreshAll();
  }, "Perfil profissional atualizado.");
}

export async function updateBarberServicesAction(barberProfileId: string, items: unknown) {
  return authed(async (s) => {
    await team.updateBarberServices(s.actor, barberProfileId, items);
    refreshAll();
  }, "Serviços atualizados.");
}

export async function recordPaymentAction(input: unknown) {
  return authed(async (s) => {
    const p = await finance.recordPayment(s.actor, input);
    refreshAll();
    return { status: p.status };
  }, "Pagamento registrado.");
}

// ─── Proprietário: parceiros e equipe ────────────────────────────────────────

export async function approvePartnerAction(input: unknown) {
  return authed(async (s) => {
    await accounts.approvePartner(s.actor, input);
    refreshAll();
  }, "Profissional aprovado e ativado.");
}

export async function rejectPartnerAction(id: string, note: string) {
  return authed(async (s) => {
    await accounts.rejectPartner(s.actor, id, note);
    refreshAll();
  }, "Solicitação recusada.");
}

export async function requestInfoAction(id: string, note: string) {
  return authed(async (s) => {
    await accounts.requestPartnerInfo(s.actor, id, note);
    refreshAll();
  }, "Pedido de complementação enviado.");
}

export async function inviteBarberAction(input: unknown) {
  return authed(async (s) => {
    const r = await accounts.inviteBarber(s.actor, input);
    refreshAll();
    return { link: r.link, barberProfileId: r.profile.id };
  }, "Profissional cadastrado. Envie o link de convite.");
}

export async function regenerateInviteAction(barberProfileId: string) {
  return authed(async (s) => {
    const link = await accounts.regenerateInvite(s.actor, barberProfileId);
    refreshAll();
    return { link };
  }, "Novo link de convite gerado.");
}

export async function offboardBarberAction(input: unknown) {
  return authed(async (s) => {
    const r = await team.offboardBarber(s.actor, input);
    refreshAll();
    return r;
  }, "Profissional desligado.");
}

export async function reactivateBarberAction(id: string) {
  return authed(async (s) => {
    await team.reactivateBarber(s.actor, id);
    refreshAll();
  }, "Profissional reativado.");
}

export async function updateCommissionAction(id: string, input: unknown) {
  return authed(async (s) => {
    await team.updateCommission(s.actor, id, input);
    refreshAll();
  }, "Regra de comissão atualizada. Valores já registrados foram preservados.");
}

export async function reviewTimeOffAction(id: string, approve: boolean) {
  return authed(async (s) => {
    await team.reviewTimeOff(s.actor, id, approve);
    refreshAll();
  }, approve ? "Folga aprovada." : "Folga recusada.");
}

export async function setAdminRoleAction(userId: string, grant: boolean) {
  return authed(async (s) => {
    await team.setAdminRole(s.actor, userId, grant);
    refreshAll();
  }, grant ? "Acesso administrativo concedido." : "Acesso administrativo removido.");
}

// ─── Proprietário: serviços e configurações ──────────────────────────────────

export async function upsertServiceAction(id: string | null, input: unknown) {
  return authed(async (s) => {
    await catalog.upsertService(s.actor, id, input);
    refreshAll();
  }, id ? "Serviço atualizado." : "Serviço criado.");
}

export async function toggleServiceAction(id: string, active: boolean) {
  return authed(async (s) => {
    await catalog.toggleService(s.actor, id, active);
    refreshAll();
  }, active ? "Serviço ativado." : "Serviço desativado.");
}

export async function createCategoryAction(name: string) {
  return authed(async (s) => {
    const c = await catalog.createCategory(s.actor, name);
    refreshAll();
    return { id: c.id };
  }, "Categoria criada.");
}

export async function updateShopSettingsAction(input: unknown) {
  return authed(async (s) => {
    await catalog.updateShopSettings(s.actor, input);
    refreshAll();
  }, "Configurações salvas.");
}

export async function updateShopHoursAction(input: unknown) {
  return authed(async (s) => {
    await catalog.updateShopHours(s.actor, input);
    refreshAll();
  }, "Horário de funcionamento salvo.");
}

export async function addHolidayAction(date: string, name: string) {
  return authed(async (s) => {
    await catalog.addHoliday(s.actor, date, name);
    refreshAll();
  }, "Feriado adicionado.");
}

export async function removeHolidayAction(id: string) {
  return authed(async (s) => {
    await catalog.removeHoliday(s.actor, id);
    refreshAll();
  }, "Feriado removido.");
}

export async function addClientNoteAction(clientUserId: string, body: string) {
  return authed(async (s) => {
    assertAdmin(s.actor);
    const text = body.trim();
    if (text.length < 2 || text.length > 500) throw new DomainError("A observação deve ter entre 2 e 500 caracteres.");
    await prisma.clientNote.create({ data: { shopId: s.actor.shopId, clientUserId, authorId: s.user.id, body: text } });
    await audit({ shopId: s.actor.shopId, actorUserId: s.user.id, action: "CLIENT_NOTE_ADDED", entity: "User", entityId: clientUserId });
    refreshAll();
  }, "Observação registrada.");
}

// ─── Proprietário: barbearia 3D ──────────────────────────────────────────────

export async function addStationAction(input: unknown) {
  return authed(async (s) => {
    const st = await scene.addStation(s.actor, input);
    revalidatePath("/admin/barbearia-3d");
    return { id: st.id };
  }, "Estação adicionada ao rascunho.");
}

export async function updateStationAction(id: string, input: unknown) {
  return authed(async (s) => {
    await scene.updateStationDraft(s.actor, id, input);
    revalidatePath("/admin/barbearia-3d");
  });
}

export async function deleteStationAction(id: string) {
  return authed(async (s) => {
    await scene.markStationDeleted(s.actor, id);
    revalidatePath("/admin/barbearia-3d");
  }, "Estação marcada para remoção.");
}

export async function updateSceneConfigAction(input: unknown) {
  return authed(async (s) => {
    await scene.updateSceneConfigDraft(s.actor, input);
    revalidatePath("/admin/barbearia-3d");
  });
}

export async function publishLayoutAction() {
  return authed(async (s) => {
    await scene.publishLayout(s.actor);
    refreshAll();
  }, "Alterações publicadas! A barbearia 3D já reflete o novo layout.");
}

export async function discardLayoutAction() {
  return authed(async (s) => {
    await scene.discardDrafts(s.actor);
    revalidatePath("/admin/barbearia-3d");
  }, "Rascunho descartado.");
}

// ─── Proprietário: financeiro ────────────────────────────────────────────────

export async function confirmPaymentAction(id: string) {
  return authed(async (s) => {
    await finance.confirmPayment(s.actor, id);
    refreshAll();
  }, "Pagamento confirmado.");
}

export async function voidPaymentAction(id: string) {
  return authed(async (s) => {
    await finance.voidPayment(s.actor, id);
    refreshAll();
  }, "Pagamento anulado.");
}

export async function recordPayoutAction(barberProfileId: string, commissionIds: string[], note: string) {
  return authed(async (s) => {
    const p = await finance.recordPayout(s.actor, barberProfileId, commissionIds, note);
    refreshAll();
    return { amountCents: p.amountCents };
  }, "Repasse registrado.");
}
