import Link from "next/link";
import { redirect } from "next/navigation";
import { requireShop } from "@/server/shop";
import { getSession, homeFor } from "@/server/auth/session";
import { AuthShell } from "@/components/layout/AuthShell";
import { LoginForm } from "@/features/auth/forms";

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; perfil?: string }> }) {
  const sp = await searchParams;
  const shop = await requireShop();
  const session = await getSession();
  if (session) redirect(sp.next?.startsWith("/") ? sp.next : homeFor(session));
  const role = sp.perfil === "BARBER" ? "BARBER" : sp.perfil === "CLIENT" ? "CLIENT" : undefined;
  return (
    <AuthShell shopName={shop.name} eyebrow={role === "BARBER" ? "Área do profissional" : role === "CLIENT" ? "Área do cliente" : "Bem-vindo de volta"} title="Entrar na sua conta">
      <LoginForm next={sp.next} preferredRole={role} />
      <div className="mt-6 grid gap-2 border-t hairline pt-5 text-center text-sm text-smoke">
        <p>
          Novo por aqui?{" "}
          <Link href={`/cadastro/cliente${sp.next ? `?next=${encodeURIComponent(sp.next)}` : ""}`} className="text-gold-soft hover:text-gold">
            Sou cliente
          </Link>{" "}
          ·{" "}
          <Link href="/cadastro/barbeiro" className="text-gold-soft hover:text-gold">
            Sou barbeiro
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
