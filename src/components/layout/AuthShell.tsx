import Link from "next/link";
import { Brand } from "./Brand";
import { Toaster } from "@/components/ui/client";

export function AuthShell({ shopName, title, subtitle, eyebrow, children, wide }: { shopName: string; title: string; subtitle?: string; eyebrow?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <main id="conteudo" className="relative min-h-dvh overflow-hidden">
      <Toaster />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_0%,rgba(200,161,101,0.14),transparent_55%),radial-gradient(ellipse_at_100%_100%,rgba(184,115,51,0.10),transparent_50%)]" />
      <div className={`relative mx-auto flex min-h-dvh flex-col px-5 py-6 ${wide ? "max-w-3xl" : "max-w-md"}`}>
        <header className="flex items-center justify-between">
          <Brand name={shopName} />
          <Link href="/" className="text-sm text-smoke hover:text-cream">
            Voltar ao início
          </Link>
        </header>
        <div className="flex flex-1 flex-col justify-center py-10">
          {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">{eyebrow}</p>}
          <h1 className="mt-2 font-display text-4xl font-semibold">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-mist">{subtitle}</p>}
          <div className="glass mt-7 rounded-3xl p-6 sm:p-7">{children}</div>
        </div>
      </div>
    </main>
  );
}
