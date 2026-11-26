import { requireShop } from "@/server/shop";
import { AuthShell } from "@/components/layout/AuthShell";
import { ForgotForm } from "@/features/auth/forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Recuperar senha" };

export default async function ForgotPage() {
  const shop = await requireShop();
  return (
    <AuthShell shopName={shop.name} title="Recuperar acesso" subtitle="Informe seu e-mail e enviaremos um link para criar uma nova senha.">
      <ForgotForm />
    </AuthShell>
  );
}
