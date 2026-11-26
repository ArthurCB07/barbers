"use client";

/** Ações sobre um agendamento: remarcar, cancelar e mudanças de estado */
import { useState } from "react";
import { CalendarClock, XCircle, Check, Play, UserX, Wallet } from "lucide-react";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { Dialog, useAction } from "@/components/ui/client";
import { cancelAppointmentAction, changeStatusAction, recordPaymentAction } from "@/server/actions/app";
import { BookingFlow } from "./BookingFlow";
import type { BarberServiceOption } from "@/features/barbershop-3d/types";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL, type AppointmentStatus } from "@/types/domain";
import { parseMoneyToCents, formatMoney } from "@/lib/utils";

export interface ActionableAppointment {
  id: string;
  status: AppointmentStatus;
  barber: { id: string; displayName: string };
  service: BarberServiceOption;
  priceCents: number;
  canReschedule: boolean;
  canCancel: boolean;
  /** Painel profissional/administrativo */
  staff?: boolean;
  started?: boolean;
}

export function AppointmentActions({ a, today, maxAdvanceDays, adminMode }: { a: ActionableAppointment; today: string; maxAdvanceDays: number; adminMode?: boolean }) {
  const [resched, setResched] = useState(false);
  const [cancel, setCancel] = useState(false);
  const [pay, setPay] = useState(false);
  const [reason, setReason] = useState("");
  const cancelAct = useAction(cancelAppointmentAction, { onSuccess: () => setCancel(false) });
  const status = useAction(changeStatusAction);

  return (
    <div className="flex flex-wrap gap-1.5">
      {a.staff && a.status === "PENDING" && (
        <Button size="sm" variant="outline" disabled={status.pending} onClick={() => status.run(a.id, "CONFIRMED", "")}>
          <Check className="h-3.5 w-3.5" /> Confirmar
        </Button>
      )}
      {a.staff && a.status === "CONFIRMED" && a.started && (
        <>
          <Button size="sm" variant="outline" disabled={status.pending} onClick={() => status.run(a.id, "IN_PROGRESS", "")}>
            <Play className="h-3.5 w-3.5" /> Iniciar
          </Button>
          <Button size="sm" variant="ghost" disabled={status.pending} onClick={() => confirm("Registrar que o cliente não compareceu?") && status.run(a.id, "NO_SHOW", "")}>
            <UserX className="h-3.5 w-3.5" /> Não compareceu
          </Button>
        </>
      )}
      {a.staff && (a.status === "IN_PROGRESS" || (a.status === "CONFIRMED" && a.started)) && (
        <Button size="sm" disabled={status.pending} onClick={() => status.run(a.id, "COMPLETED", "")}>
          <Check className="h-3.5 w-3.5" /> Concluir
        </Button>
      )}
      {a.staff && ["CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(a.status) && (
        <Button size="sm" variant="secondary" onClick={() => setPay(true)}>
          <Wallet className="h-3.5 w-3.5" /> Pagamento
        </Button>
      )}
      {a.canReschedule && (
        <Button size="sm" variant="secondary" onClick={() => setResched(true)}>
          <CalendarClock className="h-3.5 w-3.5" /> Remarcar
        </Button>
      )}
      {a.canCancel && (
        <Button size="sm" variant="danger" onClick={() => setCancel(true)}>
          <XCircle className="h-3.5 w-3.5" /> Cancelar
        </Button>
      )}

      <Dialog open={resched} onClose={() => setResched(false)} title="Remarcar atendimento" wide>
        <div className="-mx-6 -mb-6 flex h-[min(620px,68dvh)] flex-col">
        <BookingFlow
          mode="reschedule"
          appointmentId={a.id}
          barber={a.barber}
          services={[a.service]}
          fixedServiceId={a.service.id}
          today={today}
          maxAdvanceDays={maxAdvanceDays}
          isLoggedIn
          canBook
          loginHref="/entrar"
          adminMode={adminMode}
          onDone={() => setTimeout(() => setResched(false), 1800)}
        />
        </div>
      </Dialog>

      <Dialog open={cancel} onClose={() => setCancel(false)} title="Cancelar atendimento">
        <p className="mb-4 text-sm text-mist">
          {a.service.name} com {a.barber.displayName}. O horário será liberado para outras pessoas{a.staff ? " e o cliente será notificado" : ""}.
        </p>
        <Field label="Motivo (opcional)" htmlFor="reason">
          <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className="min-h-20" />
        </Field>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setCancel(false)}>
            Voltar
          </Button>
          <Button variant="danger" disabled={cancelAct.pending} onClick={() => cancelAct.run(a.id, reason)}>
            Confirmar cancelamento
          </Button>
        </div>
      </Dialog>

      {a.staff && <PaymentDialog open={pay} onClose={() => setPay(false)} appointmentId={a.id} priceCents={a.priceCents} adminMode={adminMode} />}
    </div>
  );
}

export function PaymentDialog({ open, onClose, appointmentId, priceCents, adminMode }: { open: boolean; onClose: () => void; appointmentId: string; priceCents: number; adminMode?: boolean }) {
  const [amount, setAmount] = useState((priceCents / 100).toFixed(2).replace(".", ","));
  const [method, setMethod] = useState<string>("PIX");
  const [reference, setReference] = useState("");
  const act = useAction(recordPaymentAction, { onSuccess: onClose });
  return (
    <Dialog open={open} onClose={onClose} title="Registrar pagamento presencial">
      <p className="mb-4 text-sm text-mist">
        Valor do serviço: <strong className="text-cream">{formatMoney(priceCents)}</strong>.{" "}
        {adminMode ? "Como proprietário, o registro já fica confirmado." : "O registro ficará aguardando confirmação do proprietário."}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Valor recebido (R$)" htmlFor="amount">
          <Input id="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Método" htmlFor="method">
          <Select id="method" value={method} onChange={(e) => setMethod(e.target.value)}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABEL[m]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Referência / comprovante (opcional)" htmlFor="ref" className="mt-4">
        <Input id="ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ex.: ID da transação Pix, NSU da maquininha" />
      </Field>
      <p className="mt-3 text-xs text-smoke">Pagamentos online (Pix automático, Mercado Pago, cartão) ainda não estão integrados — este é um registro manual identificado como tal.</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button disabled={act.pending} onClick={() => act.run({ appointmentId, amountCents: parseMoneyToCents(amount), method, reference })}>
          Registrar
        </Button>
      </div>
    </Dialog>
  );
}
