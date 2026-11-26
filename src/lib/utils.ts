const CONFLICT = /^(w|h|p|px|py|min-w|min-h|max-w|max-h)-/;

/** Junta classes; em largura/altura/padding, a última classe informada vence */
export function cn(...classes: Array<string | false | null | undefined>) {
  const tokens = classes.filter(Boolean).join(" ").split(/\s+/).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (let i = tokens.length - 1; i >= 0; i--) {
    const key = CONFLICT.exec(tokens[i])?.[1];
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(tokens[i]);
  }
  return out.reverse().join(" ");
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function formatMoney(cents: number) {
  return brl.format(cents / 100);
}

/** "49,90" | "49.90" | "R$ 49,90" → 4990 */
export function parseMoneyToCents(value: string): number {
  const clean = value.replace(/[^\d,.-]/g, "").trim();
  if (!clean) return NaN;
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

export function formatDuration(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

export function safeJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  // Neutraliza injeção de fórmulas em planilhas
  const guarded = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n;]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

export function toCsv(rows: Array<Record<string, unknown>>, headers: Array<{ key: string; label: string }>) {
  const head = headers.map((h) => csvEscape(h.label)).join(";");
  const body = rows.map((r) => headers.map((h) => csvEscape(r[h.key])).join(";"));
  return "﻿" + [head, ...body].join("\n");
}
