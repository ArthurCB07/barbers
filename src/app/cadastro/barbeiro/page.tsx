import Link from "next/link";
import { requireShop } from "@/server/shop";
import { getSession } from "@/server/auth/session";
import { AuthShell } from "@/components/layout/AuthShell";
import { BarberRegisterForm, PartnerRequestForm } from "@/features/auth/forms";

export const metadata = { title: "Cadastro profissional" };

export default async function BarberSignup() {
  const shop = await requireShop();
  const session = await getSession();
  if (session) {
    if (session.actor.barberProfileId) {
      return (
        <AuthShell shopName={shop.name} eyebrow="Sou barbeiro" title="Você já faz parte da equipe">
          <Link href="/barbeiro" className="text-gold-soft underline">Ir para o painel profissional</Link>
        </AuthShell>
      );
    }
    if (session.barberStatus && ["PENDING", "NEEDS_INFO"].includes(session.barberStatus)) {
      return (
        <AuthShell shopName={shop.name} eyebrow="Sou barbeiro" title="Solicitação em andamento">
          <Link href="/barbeiro/aguardando" className="text-gold-soft underline">Acompanhar minha solicitação</Link>
        </AuthShell>
      );
    }
    return (
      <AuthShell shopName={shop.name} eyebrow="Sou barbeiro" title="Faça parte da equipe" subtitle={`Conectado como ${session.user.email}. Complete seu perfil profissional.`} wide>
        <PartnerRequestForm />
      </AuthShell>
    );
  }
  return (
    <AuthShell shopName={shop.name} eyebrow="Sou barbeiro" title="Gerencie sua agenda ou faça parte da nossa equipe" subtitle="Crie sua conta e envie seu perfil profissional para análise do proprietário." wide>
      <BarberRegisterForm />
      <p className="mt-5 text-center text-sm text-smoke">
        Já é da equipe?{" "}
        <Link href="/entrar?perfil=BARBER" className="text-gold-soft hover:text-gold">
          Entrar no painel profissional
        </Link>
      </p>
    </AuthShell>
  );
}
