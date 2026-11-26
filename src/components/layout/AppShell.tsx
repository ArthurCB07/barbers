import Link from "next/link";
import { Bell } from "lucide-react";
import { prisma } from "@/server/db";
import type { SessionContext } from "@/server/auth/session";
import { Brand } from "./Brand";
import { NavLinks, RoleSwitcher, MobileNav, type NavItem } from "./AppShellClient";
import { Toaster } from "@/components/ui/client";
import { Avatar } from "@/components/ui/primitives";
import { ROLE_LABEL } from "@/types/domain";
import { logoutAction } from "@/server/actions/auth";

export async function AppShell({ session, shopName, items, children, area }: { session: SessionContext; shopName: string; items: NavItem[]; children: React.ReactNode; area: "CLIENT" | "BARBER" | "ADMIN" }) {
  const unread = await prisma.notification.count({ where: { userId: session.user.id, readAt: null } });
  const notifHref = area === "CLIENT" ? "/cliente/notificacoes" : area === "BARBER" ? "/barbeiro/notificacoes" : "/admin/notificacoes";
  const roles = session.actor.roles.filter((r) => r !== "BARBER" || session.actor.barberProfileId);
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <Toaster />
      <aside className="sticky top-0 hidden h-dvh flex-col border-r hairline bg-coal/70 p-4 lg:flex">
        <Brand name={shopName} className="px-2 py-1" />
        <p className="mt-4 px-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold">{area === "ADMIN" ? "Painel do proprietário" : area === "BARBER" ? "Painel profissional" : "Área do cliente"}</p>
        <nav className="mt-3 flex-1 overflow-y-auto" aria-label="Navegação principal">
          <NavLinks items={items} />
        </nav>
        <div className="space-y-3 border-t hairline pt-4">
          {roles.length > 1 && <RoleSwitcher roles={roles} active={area} />}
          <div className="flex items-center gap-3 px-1">
            <Avatar name={session.user.name} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-cream">{session.user.name}</p>
              <p className="truncate text-xs text-smoke">{ROLE_LABEL[area]}</p>
            </div>
            <form action={logoutAction}>
              <button className="rounded-lg px-2 py-1 text-xs text-smoke hover:bg-white/5 hover:text-cream">Sair</button>
            </form>
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b hairline bg-ink/80 px-4 py-3 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3 lg:hidden">
            <MobileNav items={items} roles={roles} active={area} shopName={shopName} />
            <Brand name={shopName} compact />
          </div>
          <p className="hidden text-sm text-smoke lg:block">
            Olá, <span className="text-cream">{session.user.name.split(" ")[0]}</span>
          </p>
          <div className="flex items-center gap-2">
            <Link href="/barbearia" className="hidden rounded-xl border border-gold/30 px-3 py-1.5 text-xs text-gold-soft hover:bg-gold/10 sm:inline-flex">
              Barbearia 3D
            </Link>
            <Link href={notifHref} className="relative rounded-xl p-2 text-mist hover:bg-white/5 hover:text-cream" aria-label={`Notificações${unread ? `: ${unread} não lidas` : ""}`}>
              <Bell className="h-5 w-5" />
              {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-ink">{unread > 9 ? "9+" : unread}</span>}
            </Link>
          </div>
        </header>
        <main id="conteudo" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
