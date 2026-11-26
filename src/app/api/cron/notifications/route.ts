import { NextResponse, type NextRequest } from "next/server";
import { processOutbox } from "@/server/services/notifications";
import { queueReminders } from "@/server/services/appointments";

export const dynamic = "force-dynamic";

/**
 * Processa a fila de notificações e agenda lembretes.
 * Chamar periodicamente (ex.: a cada 10 min via Vercel Cron, GitHub Actions
 * ou crontab) com o cabeçalho  Authorization: Bearer <CRON_SECRET>.
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const reminders = await queueReminders(24);
  const delivery = await processOutbox(100);
  return NextResponse.json({ reminders, delivery });
}

export const GET = handle;
export const POST = handle;
