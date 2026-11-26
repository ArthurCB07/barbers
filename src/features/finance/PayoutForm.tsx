"use client";

import { useMemo, useState } from "react";
import { Button, Checkbox, Input } from "@/components/ui/primitives";
import { useAction } from "@/components/ui/client";
import { recordPayoutAction } from "@/server/actions/app";
import { formatMoney } from "@/lib/utils";

/** Seleção de comissões em aberto para registrar um repasse */
export function PayoutForm({ barberProfileId, barberName, items }: { barberProfileId: string; barberName: string; items: Array<{ id: string; label: string; amountCents: number }> }) {
  const [sel, setSel] = useState<string[]>(items.map((i) => i.id));
  const [note, setNote] = useState("");
  const total = useMemo(() => items.filter((i) => sel.includes(i.id)).reduce((s, i) => s + i.amountCents, 0), [items, sel]);
  const { run, pending } = useAction(recordPayoutAction);
  return (
    <div className="rounded-xl border border-line/60 bg-coal/40 p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-medium text-cream">{barberName}</p>
        <p className="text-sm text-gold-soft">{formatMoney(total)}</p>
      </div>
      <ul className="max-h-48 space-y-1 overflow-y-auto">
        {items.map((i) => (
          <li key={i.id}>
            <Checkbox checked={sel.includes(i.id)} onChange={(e) => setSel(e.target.checked ? [...sel, i.id] : sel.filter((x) => x !== i.id))} label={<span className="text-xs">{i.label} · <strong>{formatMoney(i.amountCents)}</strong></span>} />
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <Input className="h-9" placeholder="Observação (ex.: Pix em 20/11)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Observação do repasse" />
        <Button size="sm" className="h-9" disabled={pending || sel.length === 0} onClick={() => run(barberProfileId, sel, note)}>Registrar repasse</Button>
      </div>
    </div>
  );
}
