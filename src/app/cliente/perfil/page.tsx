import Link from "next/link";
import { Scissors } from "lucide-react";
import { requireRole } from "@/server/auth/session";
import { requireShop } from "@/server/shop";
import { prisma } from "@/server/db";
import { Card, CardTitle, PageHeader } from "@/components/ui/primitives";
import { ProfileForm, PasswordForm, PrivacyCard } from "@/features/clients/ProfileForms";
import { BARBER_STATUS_LABEL, type BarberStatus } from "@/types/domain";

export const metadata = { title: "Meu perfil" };

export default async function ProfilePage() {
  const shop = await requireShop();
  const s = await requireRole("CLIENT");
  const [user, profile, barber] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: s.user.id } }),
    prisma.clientProfile.findUnique({ where: { userId_shopId: { userId: s.user.id, shopId: shop.id } } }),
    prisma.barberProfile.findFirst({ where: { userId: s.user.id, shopId: shop.id } }),
  ]);
  return (
    <>
      <PageHeader title="Meu perfil" description="Gerencie suas informações, credenciais e privacidade." />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <ProfileForm
          initial={{ name: user.name, email: user.email, phone: user.phone, notifyEmail: user.notifyEmail, notifyWhatsapp: user.notifyWhatsapp, preferences: profile?.preferences ?? "", sharePreferences: profile?.sharePreferences ?? true }}
        />
        <div className="space-y-6">
          <PasswordForm />
          <Card>
            <CardTitle>Área profissional</CardTitle>
            {barber ? (
              <p className="text-sm text-mist">
                Perfil profissional: <strong className="text-cream">{BARBER_STATUS_LABEL[barber.status as BarberStatus]}</strong>.{" "}
                <Link className="text-gold-soft underline" href={barber.status === "APPROVED" ? "/barbeiro" : "/barbeiro/aguardando"}>
                  Abrir
                </Link>
              </p>
            ) : (
              <Link href="/cadastro/barbeiro" className="flex items-center gap-2 text-sm text-gold-soft hover:text-gold">
                <Scissors className="h-4 w-4" /> Sou barbeiro e quero fazer parte da equipe
              </Link>
            )}
          </Card>
          <PrivacyCard canDelete={!s.actor.roles.includes("ADMIN")} />
        </div>
      </div>
    </>
  );
}
