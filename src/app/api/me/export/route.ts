import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { exportMyData } from "@/server/services/accounts";

/** LGPD — portabilidade: download dos dados pessoais do titular */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const data = await exportMyData(session.actor);
  return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), ...data }, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="meus-dados.json"`,
      "Cache-Control": "no-store",
    },
  });
}
