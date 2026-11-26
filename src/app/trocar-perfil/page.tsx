import { requireSession } from "@/server/auth/session";
import { requireShop } from "@/server/shop";
import { AuthShell } from "@/components/layout/AuthShell";
import { RoleSwitcher } from "@/components/layout/AppShellClient";

export default async function SwitchRolePage() {
  const shop = await requireShop();
  const s = await requireSession("/trocar-perfil");
  const roles = s.actor.roles.filter((r) => r !== "BARBER" || s.actor.barberProfileId);
  return (
    <AuthShell shopName={shop.name} title="Trocar perfil" subtitle="Escolha com qual perfil deseja continuar. Dados e permissões de cada perfil permanecem isolados.">
      <RoleSwitcher roles={roles} active={s.activeRole} />
    </AuthShell>
  );
}
