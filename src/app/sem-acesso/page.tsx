import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { requireShop } from "@/server/shop";
import { getSession, homeFor } from "@/server/auth/session";
import { AuthShell } from "@/components/layout/AuthShell";
import { buttonClass } from "@/components/ui/primitives";

export default async function NoAccess() {
  const shop = await requireShop();
  const s = await getSession();
  return (
    <AuthShell shopName={shop.name} title="Acesso restrito" subtitle="Seu perfil não tem permissão para acessar esta área.">
      <div className="flex flex-col items-center gap-4 text-center">
        <ShieldAlert className="h-10 w-10 text-warning" />
        <Link href={s ? homeFor(s) : "/entrar"} className={buttonClass("primary")}>
          {s ? "Voltar ao meu painel" : "Entrar"}
        </Link>
      </div>
    </AuthShell>
  );
}
