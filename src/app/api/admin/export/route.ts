import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { toCsv, formatMoney } from "@/lib/utils";
import { addDays, formatDateTime, isValidDateStr, todayIn, zonedToUtc } from "@/lib/time";
import { APPOINTMENT_STATUS_LABEL, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL, type AppointmentStatus, type PaymentMethod } from "@/types/domain";
import { audit } from "@/server/audit";

export const dynamic = "force-dynamic";

/** Relatórios CSV (somente proprietário) */
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || !s.actor.roles.includes("ADMIN")) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const shop = await prisma.shop.findUniqueOrThrow({ where: { id: s.actor.shopId } });
  const tz = shop.timezone;
  const p = req.nextUrl.searchParams;
  const type = p.get("type") ?? "appointments";
  const to = p.get("to") && isValidDateStr(p.get("to")!) ? p.get("to")! : todayIn(tz);
  const from = p.get("from") && isValidDateStr(p.get("from")!) ? p.get("from")! : addDays(to, -30);
  const range = { gte: zonedToUtc(from, 0, tz), lt: zonedToUtc(addDays(to, 1), 0, tz) };
  const barberId = p.get("barberId") || undefined;
  let csv = "";

  if (type === "appointments") {
    const rows = await prisma.appointment.findMany({ where: { shopId: shop.id, startsAt: range, ...(barberId ? { barberProfileId: barberId } : {}) }, include: { client: { select: { name: true } }, barber: true, service: true }, orderBy: { startsAt: "asc" } });
    csv = toCsv(
      rows.map((r) => ({ data: formatDateTime(r.startsAt, tz), cliente: r.client.name, profissional: r.barber.displayName, servico: r.service.name, valor: formatMoney(r.priceCents), estado: APPOINTMENT_STATUS_LABEL[r.status as AppointmentStatus] })),
      [{ key: "data", label: "Data/hora" }, { key: "cliente", label: "Cliente" }, { key: "profissional", label: "Profissional" }, { key: "servico", label: "Serviço" }, { key: "valor", label: "Valor" }, { key: "estado", label: "Estado" }],
    );
  } else if (type === "payments") {
    const rows = await prisma.payment.findMany({ where: { appointment: { shopId: shop.id, startsAt: range, ...(barberId ? { barberProfileId: barberId } : {}) } }, include: { appointment: { include: { client: { select: { name: true } }, barber: true, service: true } } }, orderBy: { createdAt: "asc" } });
    csv = toCsv(
      rows.map((r) => ({ data: formatDateTime(r.createdAt, tz), atendimento: formatDateTime(r.appointment.startsAt, tz), cliente: r.appointment.client.name, profissional: r.appointment.barber.displayName, servico: r.appointment.service.name, valor: formatMoney(r.amountCents), metodo: PAYMENT_METHOD_LABEL[r.method as PaymentMethod], estado: PAYMENT_STATUS_LABEL[r.status], origem: r.provider === "MANUAL" ? "Registro manual" : r.provider })),
      [{ key: "data", label: "Registrado em" }, { key: "atendimento", label: "Atendimento" }, { key: "cliente", label: "Cliente" }, { key: "profissional", label: "Profissional" }, { key: "servico", label: "Serviço" }, { key: "valor", label: "Valor" }, { key: "metodo", label: "Método" }, { key: "estado", label: "Estado" }, { key: "origem", label: "Origem" }],
    );
  } else if (type === "commissions") {
    const rows = await prisma.commission.findMany({ where: { barber: { shopId: shop.id }, appointment: { startsAt: range }, ...(barberId ? { barberProfileId: barberId } : {}) }, include: { barber: true, appointment: { include: { service: true } } }, orderBy: { createdAt: "asc" } });
    csv = toCsv(
      rows.map((r) => ({ data: formatDateTime(r.appointment.startsAt, tz), profissional: r.barber.displayName, servico: r.appointment.service.name, base: formatMoney(r.baseCents), percentual: `${r.percent}%`, comissao: formatMoney(r.amountCents), estado: r.status === "PAID" ? "Repassada" : "Em aberto" })),
      [{ key: "data", label: "Atendimento" }, { key: "profissional", label: "Profissional" }, { key: "servico", label: "Serviço" }, { key: "base", label: "Valor base" }, { key: "percentual", label: "%" }, { key: "comissao", label: "Comissão" }, { key: "estado", label: "Estado" }],
    );
  } else if (type === "clients") {
    const roles = await prisma.roleAssignment.findMany({ where: { shopId: shop.id, role: "CLIENT", user: { anonymizedAt: null } }, include: { user: { include: { appointments: { where: { shopId: shop.id }, select: { status: true, startsAt: true } } } } } });
    csv = toCsv(
      roles.map((r) => ({ nome: r.user.name, email: r.user.email, telefone: r.user.phone, cadastro: formatDateTime(r.createdAt, tz), atendimentos: r.user.appointments.filter((a) => a.status === "COMPLETED").length })),
      [{ key: "nome", label: "Nome" }, { key: "email", label: "E-mail" }, { key: "telefone", label: "Telefone" }, { key: "cadastro", label: "Cadastro" }, { key: "atendimentos", label: "Atendimentos concluídos" }],
    );
  } else {
    return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  }
  await audit({ shopId: shop.id, actorUserId: s.user.id, action: "REPORT_EXPORTED", entity: "Report", data: { type, from, to } });
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${type}-${from}-a-${to}.csv"`, "Cache-Control": "no-store" },
  });
}
