/**
 * Jornadas obrigatórias executadas contra a camada de serviços real
 * (mesmo código usado pelas Server Actions), com banco SQLite isolado.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { loadActor } from "@/server/actor";
import {
  approvePartner, authenticate, registerBarber, registerClient, inviteBarber, acceptInvite, getInvite,
  requestPartnerInfo, resubmitPartnerRequest, switchRole, bootstrapShop, requestPasswordReset, resetPassword, pickActiveRole,
} from "@/server/services/accounts";
import { addStation, getPublishedScene, publishLayout, updateStationDraft, getDraftScene, markStationDeleted, updateSceneConfigDraft } from "@/server/services/scene";
import { createAppointment } from "@/server/services/appointments";
import { updateCommission, offboardBarber, updateWorkingHours, updateBarberServices } from "@/server/services/team";
import { upsertService } from "@/server/services/catalog";
import { recordPayment, recordPayout } from "@/server/services/finance";
import { processOutbox, notify } from "@/server/services/notifications";
import { setupShop, newClient, nextTuesday, firstServiceOf } from "../helpers";

const barberData = (email: string) => ({
  name: "Novo Barbeiro",
  email,
  phone: "11977776666",
  password: "Barbeiro123",
  confirmPassword: "Barbeiro123",
  displayName: "Navalha Nova",
  bio: "Especialista em degradê e barba com toalha quente há 5 anos.",
  specialties: ["Degradê", "Barba"],
  acceptTerms: true,
});

describe("Jornada 1 — novo cliente", () => {
  it("cadastra, autentica, vê a cadeira inicial na cena e agenda", async () => {
    const { shop, ownerBarber } = await setupShop();
    await expect(registerClient(shop.id, { name: "X", email: "bad", phone: "1", password: "123", confirmPassword: "1", acceptTerms: true })).rejects.toThrow();
    const user = await registerClient(shop.id, { name: "Joana Cliente", email: "Joana@Test.dev", phone: "(11) 98888-1111", password: "Senha12345", confirmPassword: "Senha12345", acceptTerms: true });
    expect(user.email).toBe("joana@test.dev");
    await expect(registerClient(shop.id, { name: "Dup", email: "joana@test.dev", phone: "11988881111", password: "Senha12345", confirmPassword: "Senha12345", acceptTerms: true })).rejects.toThrow(/Já existe/);
    const auth = await authenticate(shop.id, { email: "joana@test.dev", password: "Senha12345" });
    expect(auth.roles).toEqual(["CLIENT"]);
    await expect(authenticate(shop.id, { email: "joana@test.dev", password: "errada123" })).rejects.toThrow(/incorretos/);

    const scene = await getPublishedScene(shop.id, nextTuesday());
    expect(scene.stations).toHaveLength(1);
    expect(scene.stations[0].barber?.id).toBe(ownerBarber.id);
    expect(scene.stations[0].state).toBe("AVAILABLE");

    const actor = await loadActor(user.id, shop.id);
    const svc = await firstServiceOf(ownerBarber.id);
    const appt = await createAppointment(actor, { barberProfileId: scene.stations[0].barber!.id, serviceId: svc.id, date: nextTuesday(), startMin: 600 });
    const mine = await prisma.appointment.findMany({ where: { clientUserId: user.id } });
    expect(mine.map((m) => m.id)).toEqual([appt.id]);
  });
});

describe("Jornada 2 — novo barbeiro por solicitação", () => {
  it("candidato fica pendente, não acessa nada de barbeiro, é aprovado e aparece no 3D", async () => {
    const { shop, ownerActor } = await setupShop();
    const { user, profile } = await registerBarber(shop.id, barberData("navalha@test.dev"));
    let actor = await loadActor(user.id, shop.id);
    expect(actor.roles).toEqual(["CLIENT"]);
    expect(actor.barberProfileId).toBeNull();
    // Não pode alterar agenda própria nem se aprovar
    await expect(updateWorkingHours(actor, profile.id, [])).rejects.toThrow(/permissão/);
    await expect(approvePartner(actor, { barberProfileId: profile.id })).rejects.toThrow(/proprietário/);
    // Admin foi notificado
    expect(await prisma.notification.count({ where: { userId: ownerActor.userId, type: "PARTNER_REQUEST_RECEIVED" } })).toBe(1);

    // Complementação de dados
    await requestPartnerInfo(ownerActor, profile.id, "Envie uma foto profissional.");
    await resubmitPartnerRequest(actor, { displayName: "Navalha Nova", bio: "Especialista em degradê e barba com toalha quente há 5 anos.", specialties: ["Degradê"], photoUrl: "/api/files/x.jpg" });

    // Proprietário cria uma estação nova e aprova vinculando-a
    const st = await addStation(ownerActor, { name: "Estação 02", model: "modern", spotKey: "A2" });
    await publishLayout(ownerActor);
    await approvePartner(ownerActor, { barberProfileId: profile.id, commissionModel: "PERCENT", commissionPercent: 40, stationId: st.id });

    actor = await loadActor(user.id, shop.id);
    expect(actor.roles.sort()).toEqual(["BARBER", "CLIENT"]);
    expect(actor.barberProfileId).toBe(profile.id);

    const scene = await getPublishedScene(shop.id, nextTuesday());
    const station = scene.stations.find((s) => s.id === st.id)!;
    expect(station.barber?.displayName).toBe("Navalha Nova");
    expect(station.state).toBe("AVAILABLE");
    const hours = await prisma.workingHours.count({ where: { barberProfileId: profile.id } });
    expect(hours).toBeGreaterThan(0);
  });
});

describe("Jornada 3 — crescimento por convite + editor 3D", () => {
  it("proprietário convida, configura serviços/jornada/comissão, vincula estação e publica", async () => {
    const { shop, ownerActor } = await setupShop();
    const services = await prisma.service.findMany({ where: { shopId: shop.id }, take: 3 });
    const { profile, token } = await inviteBarber(ownerActor, {
      name: "Carlos Tesoura",
      email: "carlos@test.dev",
      displayName: "Carlos Tesoura",
      specialties: ["Tesoura"],
      commissionModel: "PER_SERVICE",
      commissionPercent: 45,
      services: services.map((s) => ({ serviceId: s.id, priceCents: s.priceCents + 1000, durationMin: null })),
      hours: [{ weekday: 2, startMin: 600, endMin: 1080, breakStartMin: 780, breakEndMin: 840 }],
    });
    expect(profile.status).toBe("INVITED");

    // Editor: nova estação em rascunho não aparece para clientes antes de publicar
    const station = await addStation(ownerActor, { name: "Estação Carlos", model: "classic" });
    await updateStationDraft(ownerActor, station.id, { barberProfileId: profile.id, rotationOffsetDeg: 10, spotKey: "B1" });
    let pub = await getPublishedScene(shop.id, nextTuesday());
    expect(pub.stations.find((s) => s.id === station.id)).toBeUndefined();
    const draft = await getDraftScene(ownerActor);
    expect(draft.stations.find((s) => s.id === station.id)?.pending).toBe(true);
    await publishLayout(ownerActor);
    pub = await getPublishedScene(shop.id, nextTuesday());
    // Ainda sem conta: estação aparece vaga
    expect(pub.stations.find((s) => s.id === station.id)?.state).toBe("VACANT");

    expect(await getInvite(token)).not.toBeNull();
    await acceptInvite(token, { name: "Carlos Tesoura", phone: "11966665555", password: "Carlos12345", confirmPassword: "Carlos12345", acceptTerms: true });
    expect(await getInvite(token)).toBeNull(); // uso único

    pub = await getPublishedScene(shop.id, nextTuesday());
    const live = pub.stations.find((s) => s.id === station.id)!;
    expect(live.barber?.displayName).toBe("Carlos Tesoura");
    expect(live.spotKey).toBe("B1");
    expect(live.state).toBe("AVAILABLE");

    // Cliente agenda com o novo profissional usando o preço específico
    const { actor } = await newClient(shop.id);
    const appt = await createAppointment(actor, { barberProfileId: profile.id, serviceId: services[0].id, date: nextTuesday(), startMin: 600 });
    expect(appt.priceCents).toBe(services[0].priceCents + 1000);
    expect(appt.stationId).toBe(station.id);
    // Fora da jornada (09:00) não é permitido
    await expect(createAppointment(actor, { barberProfileId: profile.id, serviceId: services[0].id, date: nextTuesday(), startMin: 540 })).rejects.toThrow();
  });

  it("editor impede sobreposição, avisa falta de espaço e não remove estação com reservas", async () => {
    const { shop, ownerActor, ownerBarber } = await setupShop();
    const first = await prisma.station.findFirstOrThrow({ where: { shopId: shop.id } });
    await expect(addStation(ownerActor, { name: "Dup", model: "classic", spotKey: first.spotKey })).rejects.toThrow(/ocupado/);
    for (let i = 0; i < 5; i++) await addStation(ownerActor, { name: `Extra ${i}`, model: "classic" });
    await expect(addStation(ownerActor, { name: "Sem espaço", model: "classic" })).rejects.toThrow(/Não há espaço/);
    const another = (await getDraftScene(ownerActor)).stations.find((s) => s.id !== first.id)!;
    await expect(updateStationDraft(ownerActor, another.id, { barberProfileId: ownerBarber.id })).rejects.toThrow(/já está vinculado/);

    const { actor } = await newClient(shop.id);
    const svc = await firstServiceOf(ownerBarber.id);
    await createAppointment(actor, { barberProfileId: ownerBarber.id, serviceId: svc.id, date: nextTuesday(), startMin: 600 });
    await expect(markStationDeleted(ownerActor, first.id)).rejects.toThrow(/reservas vinculadas/);

    // Desativação reflete no estado público
    await updateStationDraft(ownerActor, first.id, { active: false });
    await updateSceneConfigDraft(ownerActor, { signText: "NOVA PLACA", accentColor: "#b87333", plants: false, sofaColor: "#333333", neon: true });
    await publishLayout(ownerActor);
    const pub = await getPublishedScene(shop.id, nextTuesday());
    expect(pub.stations.find((s) => s.id === first.id)?.state).toBe("INACTIVE");
    expect(pub.config.signText).toBe("NOVA PLACA");
  });
});

describe("Jornada 4 — administração e financeiro", () => {
  it("registra pagamentos (barbeiro → pendente, proprietário → confirmado) e repasses", async () => {
    const { shop, ownerActor } = await setupShop();
    const { user, profile } = await registerBarber(shop.id, barberData("fin@test.dev"));
    await approvePartner(ownerActor, { barberProfileId: profile.id, commissionPercent: 50 });
    const barberActor = await loadActor(user.id, shop.id);
    const { actor: client } = await newClient(shop.id);
    const svc = await prisma.service.findFirstOrThrow({ where: { shopId: shop.id, name: "Corte masculino" } });
    const appt = await createAppointment(client, { barberProfileId: profile.id, serviceId: svc.id, date: nextTuesday(), startMin: 600 });

    const p1 = await recordPayment(barberActor, { appointmentId: appt.id, amountCents: 5000, method: "CASH" });
    expect(p1.status).toBe("PENDING");
    const p2 = await recordPayment(ownerActor, { appointmentId: appt.id, amountCents: 1000, method: "PIX" });
    expect(p2.status).toBe("CONFIRMED");
    await expect(recordPayment(client, { appointmentId: appt.id, amountCents: 100, method: "CASH" })).rejects.toThrow(/permissão/);
    await expect(updateCommission(barberActor, profile.id, { commissionModel: "PERCENT", commissionPercent: 100, fixedFeeCents: 0, partnershipType: "X" })).rejects.toThrow(/proprietário/);
    await expect(updateBarberServices(barberActor, profile.id, [])).rejects.toThrow(/não liberou/);

    // Comissão + repasse
    await prisma.appointment.update({ where: { id: appt.id }, data: { startsAt: new Date(Date.now() - 3600000) } });
    const { changeAppointmentStatus } = await import("@/server/services/appointments");
    await changeAppointmentStatus(barberActor, appt.id, "COMPLETED");
    const commission = await prisma.commission.findUniqueOrThrow({ where: { appointmentId: appt.id } });
    expect(commission.amountCents).toBe(2500);
    const payout = await recordPayout(ownerActor, profile.id, [commission.id], "Semana 1");
    expect(payout.amountCents).toBe(2500);
    await expect(recordPayout(ownerActor, profile.id, [commission.id])).rejects.toThrow(/já foram pagas/);
  });

  it("serviço novo cadastrado sem código e habilitado para profissionais", async () => {
    const { ownerActor, ownerBarber } = await setupShop();
    const svc = await upsertService(ownerActor, null, { name: "Hidratação", description: "", priceCents: 3000, durationMin: 20, barberIds: [ownerBarber.id] });
    const bs = await prisma.barberService.findUnique({ where: { barberProfileId_serviceId: { barberProfileId: ownerBarber.id, serviceId: svc.id } } });
    expect(bs?.active).toBe(true);
    await expect(upsertService(ownerActor, null, { name: "Ruim", priceCents: 100, durationMin: 7 })).rejects.toThrow();
  });

  it("desligamento exige tratar reservas futuras (cancelamento com notificação)", async () => {
    const { shop, ownerActor } = await setupShop();
    const { profile } = await registerBarber(shop.id, barberData("sai@test.dev"));
    await approvePartner(ownerActor, { barberProfileId: profile.id });
    const { actor: client } = await newClient(shop.id);
    const svc = await firstServiceOf(profile.id);
    const appt = await createAppointment(client, { barberProfileId: profile.id, serviceId: svc.id, date: nextTuesday(), startMin: 600 });
    await offboardBarber(ownerActor, { barberProfileId: profile.id, strategy: "CANCEL" });
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })).status).toBe("CANCELLED");
    expect((await prisma.barberProfile.findUniqueOrThrow({ where: { id: profile.id } })).status).toBe("INACTIVE");
    expect(await prisma.notification.count({ where: { userId: client.userId, type: "APPOINTMENT_CANCELLED" } })).toBe(1);
    expect(await prisma.appointment.count({ where: { id: appt.id } })).toBe(1); // histórico preservado
  });

  it("desligamento com redistribuição transfere a reserva para outro profissional", async () => {
    const { shop, ownerActor, ownerBarber } = await setupShop();
    const { profile } = await registerBarber(shop.id, barberData("sai2@test.dev"));
    await approvePartner(ownerActor, { barberProfileId: profile.id });
    const { actor: client } = await newClient(shop.id);
    const svc = await firstServiceOf(profile.id);
    const appt = await createAppointment(client, { barberProfileId: profile.id, serviceId: svc.id, date: nextTuesday(), startMin: 600 });
    await offboardBarber(ownerActor, { barberProfileId: profile.id, strategy: "REASSIGN", targetBarberProfileId: ownerBarber.id });
    const moved = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } });
    expect(moved.barberProfileId).toBe(ownerBarber.id);
    expect(moved.status).toBe("CONFIRMED");
  });
});

describe("Jornada 5 — alternância de perfis", () => {
  it("barbeiro troca para Modo Cliente, agenda com outro barbeiro e volta", async () => {
    const { shop, ownerActor, ownerBarber } = await setupShop();
    const { user, profile } = await registerBarber(shop.id, barberData("dual@test.dev"));
    await approvePartner(ownerActor, { barberProfileId: profile.id });
    const actor = await loadActor(user.id, shop.id);
    const session = await prisma.session.create({ data: { tokenHash: "t-dual", userId: user.id, activeRole: "BARBER", expiresAt: new Date(Date.now() + 86400000) } });
    await switchRole(actor, session.id, "CLIENT");
    expect((await prisma.session.findUniqueOrThrow({ where: { id: session.id } })).activeRole).toBe("CLIENT");
    const svc = await firstServiceOf(ownerBarber.id);
    const appt = await createAppointment(actor, { barberProfileId: ownerBarber.id, serviceId: svc.id, date: nextTuesday(), startMin: 600 });
    expect(appt.clientUserId).toBe(user.id);
    // Não pode agendar consigo mesmo
    await expect(createAppointment(actor, { barberProfileId: profile.id, serviceId: (await firstServiceOf(profile.id)).id, date: nextTuesday(), startMin: 660 })).rejects.toThrow(/consigo mesmo/);
    await switchRole(actor, session.id, "BARBER");
    await expect(switchRole(actor, session.id, "ADMIN")).rejects.toThrow(/não possui/);
    expect(pickActiveRole(["CLIENT", "BARBER"], "CLIENT")).toBe("CLIENT");
  });
});

describe("segurança e configuração inicial", () => {
  it("configuração inicial só pode ser executada uma vez", async () => {
    await setupShop();
    await expect(
      bootstrapShop("outra", { shopName: "Outra Loja", ownerName: "Hacker", ownerEmail: "h@test.dev", ownerPhone: "11999999999", ownerPassword: "Hacker1234", ownerDisplayName: "Hacker", ownerIsBarber: false }),
    ).rejects.toThrow(/já foi concluída/);
  });

  it("recuperação de senha: token de uso único que encerra sessões", async () => {
    const { shop } = await setupShop();
    const { user } = await newClient(shop.id);
    await prisma.session.create({ data: { tokenHash: "old", userId: user.id, activeRole: "CLIENT", expiresAt: new Date(Date.now() + 86400000) } });
    const res = await requestPasswordReset(user.email);
    expect(res).not.toBeNull();
    expect(await requestPasswordReset("naoexiste@test.dev")).toBeNull();
    const token = res!.link.split("/").pop()!;
    await resetPassword(token, "NovaSenha123", "NovaSenha123");
    await expect(resetPassword(token, "Outra12345", "Outra12345")).rejects.toThrow(/inválido|utilizado/);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    await authenticate(shop.id, { email: user.email, password: "NovaSenha123" });
  });

  it("fila de notificações não duplica e não marca como enviado sem provedor", async () => {
    const { shop } = await setupShop();
    const { user } = await newClient(shop.id);
    await notify({ userId: user.id, type: "APPOINTMENT_REMINDER", title: "Lembrete", body: "x", dedupeKey: "reminder:abc" });
    await notify({ userId: user.id, type: "APPOINTMENT_REMINDER", title: "Lembrete", body: "x", dedupeKey: "reminder:abc" });
    expect(await prisma.notification.count({ where: { userId: user.id, type: "APPOINTMENT_REMINDER" } })).toBe(1);
    const summary = await processOutbox();
    expect(summary.sent).toBe(0);
    const email = await prisma.notificationDelivery.findFirst({ where: { dedupeKey: "reminder:abc:EMAIL" } });
    expect(email?.status).toBe("SKIPPED");
  });
});
