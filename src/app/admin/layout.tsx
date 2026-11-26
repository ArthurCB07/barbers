import { requireRole } from "@/server/auth/session";
import { requireShop } from "@/server/shop";
import { prisma } from "@/server/db";
import { AppShell } from "@/components/layout/AppShell";
import type { NavItem } from "@/components/layout/AppShellClient";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const shop = await requireShop();
  const session = await requireRole("ADMIN", "/admin");
  const [pendingRequests, pendingPayments] = await Promise.all([
    prisma.barberProfile.count({ where: { shopId: shop.id, status: "PENDING" } }),
    prisma.payment.count({ where: { status: "PENDING", appointment: { shopId: shop.id } } }),
  ]);
  const items: NavItem[] = [
    { href: "/admin", label: "Dashboard", icon: "LayoutDashboard", exact: true },
    { href: "/admin/agendamentos", label: "Agendamentos", icon: "CalendarDays" },
    { href: "/admin/equipe", label: "Equipe e Parceiros", icon: "Users" },
    { href: "/admin/solicitacoes", label: "Solicitações de Parceiros", icon: "Inbox", badge: pendingRequests },
    { href: "/admin/barbearia-3d", label: "Minha Barbearia 3D", icon: "Box" },
    { href: "/admin/servicos", label: "Serviços", icon: "Scissors" },
    { href: "/admin/clientes", label: "Clientes", icon: "User" },
    { href: "/admin/financeiro", label: "Financeiro", icon: "Wallet", badge: pendingPayments },
    { href: "/admin/configuracoes", label: "Configurações", icon: "Settings" },
    { href: "/admin/auditoria", label: "Auditoria", icon: "ShieldCheck" },
    { href: "/admin/notificacoes", label: "Notificações", icon: "Bell" },
  ];
  return (
    <AppShell session={session} shopName={shop.name} items={items} area="ADMIN">
      {children}
    </AppShell>
  );
}
