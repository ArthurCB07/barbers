/**
 * Tipos de domínio e rótulos. Strings validadas no servidor para manter o
 * mesmo schema em SQLite (dev) e Postgres/Supabase (produção).
 */

export const ROLES = ["CLIENT", "BARBER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABEL: Record<Role, string> = {
  CLIENT: "Cliente",
  BARBER: "Barbeiro",
  ADMIN: "Proprietário",
};
export const ROLE_HOME: Record<Role, string> = {
  CLIENT: "/cliente",
  BARBER: "/barbeiro",
  ADMIN: "/admin",
};

export const BARBER_STATUS = ["PENDING", "NEEDS_INFO", "APPROVED", "REJECTED", "INACTIVE", "INVITED"] as const;
export type BarberStatus = (typeof BARBER_STATUS)[number];
export const BARBER_STATUS_LABEL: Record<BarberStatus, string> = {
  PENDING: "Aguardando aprovação",
  NEEDS_INFO: "Complementação solicitada",
  APPROVED: "Ativo",
  REJECTED: "Recusado",
  INACTIVE: "Desligado",
  INVITED: "Convite enviado",
};

export const APPOINTMENT_STATUS = ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUS)[number];
export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  IN_PROGRESS: "Em atendimento",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  NO_SHOW: "Não compareceu",
};
/** Estados que ocupam a agenda */
export const BLOCKING_STATUSES: AppointmentStatus[] = ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "NO_SHOW"];
export const ACTIVE_STATUSES: AppointmentStatus[] = ["PENDING", "CONFIRMED", "IN_PROGRESS"];

/** Transições permitidas */
export const STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export const COMMISSION_MODELS = ["PERCENT", "PER_SERVICE", "FIXED"] as const;
export type CommissionModel = (typeof COMMISSION_MODELS)[number];
export const COMMISSION_MODEL_LABEL: Record<CommissionModel, string> = {
  PERCENT: "Comissionado (% único)",
  PER_SERVICE: "Comissão por serviço",
  FIXED: "Parceria com valor fixo",
};

export const PAYMENT_METHODS = ["CASH", "PIX", "CREDIT_CARD", "DEBIT_CARD", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "Dinheiro",
  PIX: "Pix (presencial/manual)",
  CREDIT_CARD: "Cartão de crédito (maquininha)",
  DEBIT_CARD: "Cartão de débito (maquininha)",
  OTHER: "Outro",
};
export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Aguardando confirmação",
  CONFIRMED: "Confirmado",
  VOIDED: "Estornado/anulado",
};

export const TIME_OFF_KINDS = ["DAY_OFF", "VACATION", "BLOCK"] as const;
export type TimeOffKind = (typeof TIME_OFF_KINDS)[number];
export const TIME_OFF_LABEL: Record<TimeOffKind, string> = {
  DAY_OFF: "Folga",
  VACATION: "Férias",
  BLOCK: "Bloqueio de agenda",
};

export const STATION_STATE = ["AVAILABLE", "FULL", "UNAVAILABLE", "INACTIVE", "VACANT"] as const;
export type StationState = (typeof STATION_STATE)[number];
export const STATION_STATE_LABEL: Record<StationState, string> = {
  AVAILABLE: "Disponível para agendamento",
  FULL: "Sem horários livres nesta data",
  UNAVAILABLE: "Profissional temporariamente indisponível",
  INACTIVE: "Estação inativa",
  VACANT: "Estação sem profissional",
};

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };
