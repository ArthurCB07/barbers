import { NextResponse, type NextRequest } from "next/server";

/**
 * Barreira leve: rotas privadas exigem cookie de sessão. A validação real
 * (sessão no banco, papéis e status) acontece nos layouts e na camada de
 * serviços — este middleware apenas evita renderizar páginas sem sessão.
 */
const PRIVATE = ["/cliente", "/barbeiro", "/admin", "/trocar-perfil"];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PRIVATE.some((p) => pathname === p || pathname.startsWith(`${p}/`)) && !req.cookies.get("bv_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/cliente/:path*", "/barbeiro/:path*", "/admin/:path*", "/trocar-perfil"] };
