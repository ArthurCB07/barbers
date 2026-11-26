import { NextResponse, type NextRequest } from "next/server";
import { getShop } from "@/server/shop";
import { getPublishedScene } from "@/server/services/scene";
import { isValidDateStr } from "@/lib/time";

export const dynamic = "force-dynamic";

/** Dados publicados da barbearia 3D com estados reais das estações */
export async function GET(req: NextRequest) {
  const shop = await getShop();
  if (!shop) return NextResponse.json({ error: "Barbearia não configurada" }, { status: 503 });
  const date = req.nextUrl.searchParams.get("date");
  const data = await getPublishedScene(shop.id, date && isValidDateStr(date) ? date : undefined);
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
