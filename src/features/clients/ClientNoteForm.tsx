"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/primitives";
import { SubmitButton, useAction } from "@/components/ui/client";
import { addClientNoteAction } from "@/server/actions/app";

export function ClientNoteForm({ clientUserId }: { clientUserId: string }) {
  const [body, setBody] = useState("");
  const { run, pending } = useAction((b: string) => addClientNoteAction(clientUserId, b), { onSuccess: () => setBody("") });
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void run(body); }}>
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={500} placeholder="Observação interna (visível apenas para administradores)" aria-label="Nova observação" className="min-h-20" />
      <SubmitButton pending={pending} size="sm" variant="secondary">Registrar observação</SubmitButton>
    </form>
  );
}
