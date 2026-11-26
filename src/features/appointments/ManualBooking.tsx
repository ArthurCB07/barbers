"use client";

/** Lançamento manual de agendamento pelo proprietário */
import { useMemo, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { Button, Field, Input, Select } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/client";
import { BookingFlow } from "./BookingFlow";
import type { BarberServiceOption } from "@/features/barbershop-3d/types";

export function ManualBooking({ clients, barbers, today, maxAdvanceDays }: { clients: Array<{ id: string; name: string; email: string }>; barbers: Array<{ id: string; displayName: string; services: BarberServiceOption[] }>; today: string; maxAdvanceDays: number }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [clientId, setClientId] = useState("");
  const [barberId, setBarberId] = useState("");
  const filtered = useMemo(() => clients.filter((c) => `${c.name} ${c.email}`.toLowerCase().includes(q.toLowerCase())).slice(0, 50), [clients, q]);
  const barber = barbers.find((b) => b.id === barberId);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <CalendarPlus className="h-4 w-4" /> Novo agendamento manual
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Agendamento manual" wide>
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <Field label="Buscar cliente" htmlFor="cq">
            <Input id="cq" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome ou e-mail" />
          </Field>
          <Field label="Cliente" htmlFor="cid">
            <Select id="cid" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Selecione…</option>
              {filtered.map((c) => (
                <option key={c.id} value={c.id}>{c.name} — {c.email}</option>
              ))}
            </Select>
          </Field>
          <Field label="Profissional" htmlFor="bid" className="sm:col-span-2">
            <Select id="bid" value={barberId} onChange={(e) => setBarberId(e.target.value)}>
              <option value="">Selecione…</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>{b.displayName}</option>
              ))}
            </Select>
          </Field>
        </div>
        <p className="mb-4 text-xs text-smoke">O cliente precisa ter conta. Lançamentos manuais ignoram a antecedência mínima, mas respeitam jornada, folgas e conflitos.</p>
        {clientId && barber && (
          <div className="-mx-6 -mb-6 flex h-[min(520px,52dvh)] min-h-[340px] flex-col border-t border-line/60">
          <BookingFlow key={`${clientId}-${barber.id}`} barber={barber} services={barber.services} today={today} maxAdvanceDays={maxAdvanceDays} isLoggedIn canBook loginHref="/entrar" clientUserId={clientId} adminMode />
          </div>
        )}
      </Dialog>
    </>
  );
}
