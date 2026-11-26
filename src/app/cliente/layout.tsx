import { requireRole } from "@/server/auth/session";
import { requireShop } from "@/server/shop";
import { AppShell } from "@/components/layout/AppShell";
import type { NavItem } from "@/components/layout/AppShellClient";

export const dynamic = "force-dynamic";

const items: NavItem[] = [
  { href: "/cliente", label: "Início", icon: "Home", exact: true },
  { href: "/cliente/agendar", label: "Agendar", icon: "CalendarPlus" },
  { href: "/cliente/agendamentos", label: "Meus agendamentos", icon: "CalendarDays" },
  { href: "/cliente/historico", label: "Histórico", icon: "History" },
  { href: "/cliente/barbeiros", label: "Meus barbeiros", icon: "Heart" },
  { href: "/cliente/notificacoes", label: "Notificações", icon: "Bell" },
  { href: "/cliente/perfil", label: "Meu perfil", icon: "User" },
];

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const shop = await requireShop();
  const session = await requireRole("CLIENT", "/cliente");
  return (
    <AppShell session={session} shopName={shop.name} items={items} area="CLIENT">
      {children}
    </AppShell>
  );
}
