import { redirect } from "next/navigation";
import { countAdmins } from "@/server/services/accounts";
import { AuthShell } from "@/components/layout/AuthShell";
import { SetupForm } from "@/features/auth/forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Configuração inicial" };

/** Executável uma única vez: cria a barbearia e o primeiro proprietário */
export default async function SetupPage() {
  if ((await countAdmins()) > 0) redirect("/");
  return (
    <AuthShell shopName="Barberverse" eyebrow="Configuração inicial · executada uma única vez" title="Criar a barbearia e o proprietário" subtitle="Informe o SETUP_TOKEN definido nas variáveis de ambiente do servidor. Depois desta etapa, esta página é desativada." wide>
      <SetupForm />
    </AuthShell>
  );
}
