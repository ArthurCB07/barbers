import { requireRole } from "@/server/auth/session";
import { requireShop } from "@/server/shop";
import { AppShell } from "@/components/layout/AppShell";
import type { NavItem } from "@/components/layout/AppShellClient";

export const dynamic = "force-dynamic";

const items: NavItem[] = [
  { href: "/barbeiro", label: "Visão geral", icon: "LayoutDashboard", exact: true },
  { href: "/barbeiro/agenda", label: "Agenda", icon: "CalendarDays" },
  { href: "/barbeiro/disponibilidade", label: "Disponibilidade", icon: "Clock" },
  { href: "/barbeiro/clientes", label: "Clientes", icon: "Users" },
  { href: "/barbeiro/financeiro", label: "Financeiro", icon: "Wallet" },
  { href: "/barbeiro/meu-espaco", label: "Meu espaço 3D", icon: "Box" },
  { href: "/barbeiro/notificacoes", label: "Notificações", icon: "Bell" },
];

export default async function BarberLayout({ children }: { children: React.ReactNode }) {
  const shop = await requireShop();
  const session = await requireRole("BARBER", "/barbeiro");
  return (
    <AppShell session={session} shopName={shop.name} items={items} area="BARBER">
      {children}
    </AppShell>
  );
}
