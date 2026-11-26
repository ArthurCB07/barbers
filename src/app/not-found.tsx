import Link from "next/link";
import { Scissors } from "lucide-react";
import { buttonClass } from "@/components/ui/primitives";

export const metadata = { title: "Página não encontrada" };

export default function NotFound() {
  return (
    <main id="conteudo" className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Scissors className="h-10 w-10 -rotate-45 text-gold" />
      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.3em] text-gold">Erro 404</p>
      <h1 className="mt-2 font-display text-4xl font-semibold">Esta página não existe</h1>
      <p className="mt-2 max-w-sm text-sm text-smoke">O endereço pode ter mudado ou o registro foi removido.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/" className={buttonClass("primary")}>Ir para o início</Link>
        <Link href="/barbearia" className={buttonClass("outline")}>Ver a barbearia</Link>
      </div>
    </main>
  );
}
