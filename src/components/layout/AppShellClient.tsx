"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Menu, X, Repeat, Home, CalendarPlus, CalendarDays, History, Heart, Bell, User, LayoutDashboard, Clock, Users, Wallet, Box, Scissors, Inbox, Settings, ShieldCheck,
} from "lucide-react";

const Icons = { Home, CalendarPlus, CalendarDays, History, Heart, Bell, User, LayoutDashboard, Clock, Users, Wallet, Box, Scissors, Inbox, Settings, ShieldCheck };
import { cn } from "@/lib/utils";
import { useAction } from "@/components/ui/client";
import { switchRoleAction, logoutAction } from "@/server/actions/auth";
import { ROLE_LABEL, type Role } from "@/types/domain";
import { Brand } from "./Brand";

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof Icons;
  exact?: boolean;
  badge?: number;
}

export function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <ul className="space-y-0.5">
      {items.map((it) => {
        const active = it.exact ? path === it.href : path === it.href || path.startsWith(`${it.href}/`);
        const Icon = Icons[it.icon] as React.ComponentType<{ className?: string }>;
        return (
          <li key={it.href}>
            <Link
              href={it.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition", active ? "bg-gold/12 text-gold-soft shadow-[inset_2px_0_0_#c8a165]" : "text-mist hover:bg-white/5 hover:text-cream")}
            >
              {Icon && <Icon className="h-4 w-4 shrink-0" />}
              <span className="flex-1">{it.label}</span>
              {!!it.badge && <span className="rounded-full bg-gold px-1.5 text-[10px] font-bold text-ink">{it.badge}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function RoleSwitcher({ roles, active }: { roles: Role[]; active: Role }) {
  const { run, pending } = useAction(switchRoleAction, { refresh: false, onSuccess: (d) => d && window.location.assign(d.redirectTo) });
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-smoke">
        <Repeat className="h-3 w-3" /> Trocar perfil
      </p>
      <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-graphite/60 p-1" role="radiogroup" aria-label="Trocar perfil">
        {(["CLIENT", "BARBER", "ADMIN"] as Role[])
          .filter((r) => roles.includes(r))
          .map((r) => (
            <button
              key={r}
              role="radio"
              aria-checked={r === active}
              disabled={pending}
              onClick={() => r !== active && run(r)}
              className={cn("rounded-lg px-1 py-1.5 text-[11px] font-medium transition", r === active ? "bg-gold text-ink" : "text-mist hover:bg-white/5")}
            >
              {r === "ADMIN" ? "Dono" : ROLE_LABEL[r]}
            </button>
          ))}
      </div>
    </div>
  );
}

export function MobileNav({ items, roles, active, shopName }: { items: NavItem[]; roles: Role[]; active: Role; shopName: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-mist hover:bg-white/5" aria-label="Abrir menu" aria-expanded={open}>
        <Menu className="h-5 w-5" />
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col bg-coal p-4 shadow-2xl animate-fade-up">
            <div className="flex items-center justify-between">
              <Brand name={shopName} />
              <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-smoke" aria-label="Fechar menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="mt-6 flex-1 overflow-y-auto">
              <NavLinks items={[...items, { href: "/barbearia", label: "Barbearia 3D", icon: "Box" }]} onNavigate={() => setOpen(false)} />
            </nav>
            <div className="space-y-3 border-t hairline pt-4">
              {roles.length > 1 && <RoleSwitcher roles={roles} active={active} />}
              <form action={logoutAction}>
                <button className="w-full rounded-xl border border-line py-2 text-sm text-mist">Sair</button>
              </form>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
