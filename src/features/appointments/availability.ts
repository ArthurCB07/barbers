/**
 * Motor de disponibilidade (função pura, sem acesso ao banco).
 *
 * Recebe as regras do dia já carregadas e devolve os horários de início
 * realmente livres para um serviço de determinada duração.
 */
import { diffDays, todayIn, zonedToUtc } from "@/lib/time";

export interface Interval {
  start: Date;
  end: Date;
}

export interface DayRules {
  date: string; // YYYY-MM-DD no fuso do estabelecimento
  tz: string;
  now: Date;
  shopHours: { openMin: number; closeMin: number } | null; // null = fechado
  isHoliday: boolean;
  working: { startMin: number; endMin: number; breakStartMin?: number | null; breakEndMin?: number | null } | null;
  timeOff: Interval[]; // folgas, férias, bloqueios aprovados
  busy: Interval[]; // atendimentos existentes (já incluindo pausa pós-atendimento)
  durationMin: number;
  stepMin: number;
  bufferMin: number;
  minAdvanceMinutes: number;
  maxAdvanceDays: number;
}

export interface Slot {
  startMin: number;
  start: Date;
  end: Date;
}

export type UnavailableReason = "CLOSED" | "HOLIDAY" | "NOT_WORKING" | "OUT_OF_RANGE" | "TIME_OFF" | null;

export function dayUnavailableReason(r: Pick<DayRules, "date" | "tz" | "now" | "shopHours" | "isHoliday" | "working" | "maxAdvanceDays">): UnavailableReason {
  const daysAhead = diffDays(todayIn(r.tz, r.now), r.date);
  if (daysAhead < 0 || daysAhead > r.maxAdvanceDays) return "OUT_OF_RANGE";
  if (r.isHoliday) return "HOLIDAY";
  if (!r.shopHours) return "CLOSED";
  if (!r.working) return "NOT_WORKING";
  return null;
}

const overlaps = (aStart: number, aEnd: number, b: Interval) => aStart < b.end.getTime() && aEnd > b.start.getTime();

export function generateSlots(r: DayRules): Slot[] {
  if (dayUnavailableReason(r)) return [];
  const shop = r.shopHours!;
  const work = r.working!;
  const windowStart = Math.max(shop.openMin, work.startMin);
  const windowEnd = Math.min(shop.closeMin, work.endMin);
  if (windowEnd - windowStart < r.durationMin) return [];

  const hasBreak = work.breakStartMin != null && work.breakEndMin != null && work.breakEndMin > work.breakStartMin;
  const earliest = r.now.getTime() + r.minAdvanceMinutes * 60000;
  const blocked = [...r.busy, ...r.timeOff];
  const slots: Slot[] = [];

  for (let t = windowStart; t + r.durationMin <= windowEnd; t += r.stepMin) {
    const endMin = t + r.durationMin;
    if (hasBreak && t < work.breakEndMin! && endMin > work.breakStartMin!) continue;
    const start = zonedToUtc(r.date, t, r.tz);
    const startMs = start.getTime();
    if (startMs < earliest) continue;
    const endMs = startMs + r.durationMin * 60000;
    const occupiedEnd = endMs + r.bufferMin * 60000;
    if (blocked.some((b) => overlaps(startMs, occupiedEnd, b))) continue;
    slots.push({ startMin: t, start, end: new Date(endMs) });
  }
  return slots;
}

/** Unidades de 5 minutos ocupadas por um atendimento (base da trava no banco) */
export const SLOT_UNIT_MIN = 5;
export function slotUnits(start: Date, end: Date): Date[] {
  const unit = SLOT_UNIT_MIN * 60000;
  const first = Math.floor(start.getTime() / unit) * unit;
  const units: Date[] = [];
  for (let t = first; t < end.getTime(); t += unit) units.push(new Date(t));
  return units;
}
