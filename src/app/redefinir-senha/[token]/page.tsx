import { requireShop } from "@/server/shop";
import { AuthShell } from "@/components/layout/AuthShell";
import { ResetForm } from "@/features/auth/forms";

export const metadata = { title: "Redefinir senha" };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const shop = await requireShop();
  return (
    <AuthShell shopName={shop.name} title="Criar nova senha" subtitle="Por segurança, todas as sessões abertas serão encerradas.">
      <ResetForm token={token} />
    </AuthShell>
  );
}
