/**
 * Utilitários de fuso horário.
 *
 * Armazenamento: sempre UTC (DateTime do banco).
 * Apresentação e regras de agenda: fuso do estabelecimento (America/Sao_Paulo).
 * Datas "de calendário" trafegam como string YYYY-MM-DD e horários como
 * minutos desde 00:00 no fuso do estabelecimento.
 */

export const DEFAULT_TZ = "America/Sao_Paulo";

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string) {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    dtfCache.set(tz, f);
  }
  return f;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export interface ZonedParts {
  date: string; // YYYY-MM-DD
  minutes: number; // minutos desde 00:00
  weekday: number; // 0 = domingo
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export function toZoned(date: Date, tz = DEFAULT_TZ): ZonedParts {
  const parts = Object.fromEntries(partsFormatter(tz).formatToParts(date).map((p) => [p.type, p.value]));
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour) % 24;
  const minute = Number(parts.minute);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: hour * 60 + minute,
    weekday: WEEKDAYS[parts.weekday as string] ?? 0,
    year,
    month,
    day,
    hour,
    minute,
  };
}

/** Diferença (em minutos) entre o horário local do fuso e o UTC no instante dado. */
export function tzOffsetMinutes(date: Date, tz = DEFAULT_TZ): number {
  const p = toZoned(date, tz);
  const seconds = date.getUTCSeconds();
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, seconds);
  return Math.round((asUtc - (date.getTime() - date.getUTCMilliseconds())) / 60000);
}

export function parseDateStr(dateStr: string): { y: number; m: number; d: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) throw new Error(`Data inválida: ${dateStr}`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

export function isValidDateStr(dateStr: string): boolean {
  try {
    const { y, m, d } = parseDateStr(dateStr);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  } catch {
    return false;
  }
}

/** Converte data local + minutos (no fuso) para instante UTC. */
export function zonedToUtc(dateStr: string, minutes: number, tz = DEFAULT_TZ): Date {
  const { y, m, d } = parseDateStr(dateStr);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  const off1 = tzOffsetMinutes(new Date(guess), tz);
  let result = guess - off1 * 60000;
  const off2 = tzOffsetMinutes(new Date(result), tz);
  if (off2 !== off1) result = guess - off2 * 60000;
  return new Date(result);
}

export function weekdayOf(dateStr: string): number {
  const { y, m, d } = parseDateStr(dateStr);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(dateStr: string, days: number): string {
  const { y, m, d } = parseDateStr(dateStr);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function todayIn(tz = DEFAULT_TZ, now = new Date()): string {
  return toZoned(now, tz).date;
}

export function diffDays(a: string, b: string): number {
  const pa = parseDateStr(a);
  const pb = parseDateStr(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86400000);
}

export function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function hhmmToMinutes(value: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) throw new Error(`Horário inválido: ${value}`);
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 24 || m > 59) throw new Error(`Horário inválido: ${value}`);
  return h * 60 + m;
}

export function formatDate(date: Date | string, tz = DEFAULT_TZ, opts: Intl.DateTimeFormatOptions = {}) {
  const d = typeof date === "string" ? zonedToUtc(date, 12 * 60, tz) : date;
  return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, day: "2-digit", month: "2-digit", year: "numeric", ...opts }).format(d);
}

export function formatTime(date: Date, tz = DEFAULT_TZ) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(date);
}

export function formatDateTime(date: Date, tz = DEFAULT_TZ) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz,
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatLongDate(dateStr: string, tz = DEFAULT_TZ) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(zonedToUtc(dateStr, 12 * 60, tz));
}

export const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
