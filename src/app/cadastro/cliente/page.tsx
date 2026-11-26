import Link from "next/link";
import { requireShop } from "@/server/shop";
import { AuthShell } from "@/components/layout/AuthShell";
import { ClientRegisterForm } from "@/features/auth/forms";

export const metadata = { title: "Cadastro de cliente" };

export default async function ClientSignup({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const shop = await requireShop();
  return (
    <AuthShell shopName={shop.name} eyebrow="Sou cliente" title="Crie sua conta" subtitle="Agende seu horário e conheça nossa barbearia em 3D." wide>
      <ClientRegisterForm next={next?.startsWith("/") ? next : undefined} />
      <p className="mt-5 text-center text-sm text-smoke">
        Já tem conta?{" "}
        <Link href={`/entrar?perfil=CLIENT${next ? `&next=${encodeURIComponent(next)}` : ""}`} className="text-gold-soft hover:text-gold">
          Entrar
        </Link>
      </p>
    </AuthShell>
  );
}
