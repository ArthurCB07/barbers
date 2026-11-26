import type { ActionableAppointment } from "./AppointmentActions";
import type { AppointmentStatus } from "@/types/domain";

type ApptRow = {
  id: string;
  status: string;
  startsAt: Date;
  priceCents: number;
  durationMin: number;
  barber: { id: string; displayName: string };
  service: { id: string; name: string; description: string; imageUrl: string | null };
};

/** Converte um agendamento do banco em dados para o componente de ações */
export function toActionable(a: ApptRow, opts: { role: "CLIENT" | "BARBER" | "ADMIN"; policyHours: number; now?: Date }): ActionableAppointment {
  const now = opts.now ?? new Date();
  const editable = ["PENDING", "CONFIRMED"].includes(a.status);
  const future = a.startsAt > now;
  const withinPolicy = a.startsAt.getTime() - now.getTime() >= opts.policyHours * 3600000;
  const staff = opts.role !== "CLIENT";
  return {
    id: a.id,
    status: a.status as AppointmentStatus,
    barber: { id: a.barber.id, displayName: a.barber.displayName },
    service: { id: a.service.id, name: a.service.name, description: a.service.description, category: "", priceCents: a.priceCents, durationMin: a.durationMin, imageUrl: a.service.imageUrl },
    priceCents: a.priceCents,
    canReschedule: editable && future && (staff || withinPolicy),
    canCancel: editable && (staff || (future && withinPolicy)),
    staff,
    started: a.startsAt.getTime() - now.getTime() <= 30 * 60000,
  };
}
