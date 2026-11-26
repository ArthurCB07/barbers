import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/server/auth/session";
import { saveImage } from "@/server/storage";
import { rateLimit } from "@/server/rate-limit";

export async function POST(req: NextRequest) {
  const session = await getSession();
  // Upload permitido para usuários autenticados (inclui candidatos a barbeiro após o cadastro)
  if (!session) return NextResponse.json({ error: "Entre na sua conta para enviar imagens." }, { status: 401 });
  try {
    await rateLimit(`upload:${session.user.id}`, 20, 60 * 60);
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Arquivo ausente" }, { status: 400 });
    const url = await saveImage(Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Falha no envio" }, { status: 400 });
  }
}
