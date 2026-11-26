"use client";

import { useEffect } from "react";
import { Button, buttonClass } from "@/components/ui/primitives";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="conteudo" className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-4xl font-semibold">Algo deu errado</h1>
      <p className="mt-2 max-w-sm text-sm text-smoke">Não foi possível carregar esta tela. Tente novamente em instantes.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>Tentar novamente</Button>
        <a href="/" className={buttonClass("outline")}>Ir para o início</a>
      </div>
    </main>
  );
}
