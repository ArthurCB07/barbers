import { NextResponse, type NextRequest } from "next/server";
import { getShop } from "@/server/shop";
import { getAvailability } from "@/server/services/appointments";
import { getSession } from "@/server/auth/session";
import { DomainError } from "@/server/errors";
import { minutesToHHMM } from "@/lib/time";

export const dynamic = "force-dynamic";

/** Horários realmente livres (recalculados no servidor a cada consulta) */
export async function GET(req: NextRequest) {
  const shop = await getShop();
  if (!shop) return NextResponse.json({ error: "Barbearia não configurada" }, { status: 503 });
  const p = req.nextUrl.searchParams;
  const barberProfileId = p.get("barberId") ?? "";
  const serviceId = p.get("serviceId") ?? "";
  const date = p.get("date") ?? "";
  const exclude = p.get("exclude") ?? undefined;
  try {
    let excludeAppointmentId: string | undefined;
    let ignoreMinAdvance = false;
    const session = exclude || p.get("admin") ? await getSession() : null;
    if (exclude && session) {
      // Só exclui da conta um agendamento que o usuário pode ver
      excludeAppointmentId = exclude;
    }
    if (p.get("admin") && session?.actor.roles.includes("ADMIN")) ignoreMinAdvance = true;
    const { slots, reason, durationMin } = await getAvailability({ shopId: shop.id, barberProfileId, serviceId, date, excludeAppointmentId, ignoreMinAdvance });
    return NextResponse.json(
      { date, durationMin, reason, slots: slots.map((s) => ({ startMin: s.startMin, label: minutesToHHMM(s.startMin), start: s.start.toISOString() })) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const msg = err instanceof DomainError ? err.message : "Parâmetros inválidos";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
