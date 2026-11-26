import { describe, expect, it } from "vitest";
import { generateSlots, slotUnits, type DayRules } from "@/features/appointments/availability";
import { addDays, toZoned, zonedToUtc, weekdayOf, diffDays } from "@/lib/time";

const TZ = "America/Sao_Paulo";
const DATE = "2026-12-08"; // terça-feira
const now = zonedToUtc("2026-12-01", 8 * 60, TZ);

function rules(over: Partial<DayRules> = {}): DayRules {
  return {
    date: DATE,
    tz: TZ,
    now,
    shopHours: { openMin: 9 * 60, closeMin: 18 * 60 },
    isHoliday: false,
    working: { startMin: 9 * 60, endMin: 18 * 60, breakStartMin: 12 * 60, breakEndMin: 13 * 60 },
    timeOff: [],
    busy: [],
    durationMin: 30,
    stepMin: 30,
    bufferMin: 0,
    minAdvanceMinutes: 60,
    maxAdvanceDays: 45,
    ...over,
  };
}

describe("fuso horário", () => {
  it("converte horário local de São Paulo (UTC-3) para UTC", () => {
    const d = zonedToUtc(DATE, 9 * 60, TZ);
    expect(d.toISOString()).toBe("2026-12-08T12:00:00.000Z");
    expect(toZoned(d, TZ)).toMatchObject({ date: DATE, minutes: 540, weekday: 2 });
  });
  it("calcula dia da semana e diferença de dias", () => {
    expect(weekdayOf("2026-12-06")).toBe(0);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(diffDays("2026-12-01", "2026-12-08")).toBe(7);
  });
});

describe("motor de disponibilidade", () => {
  it("gera horários respeitando intervalo de almoço", () => {
    const slots = generateSlots(rules());
    const mins = slots.map((s) => s.startMin);
    expect(mins[0]).toBe(540);
    expect(mins).not.toContain(720); // 12:00 almoço
    expect(mins).not.toContain(750);
    expect(mins).toContain(780); // 13:00
    expect(mins.at(-1)).toBe(17 * 60 + 30);
    expect(slots).toHaveLength(16);
  });

  it("considera a duração do serviço (não invade almoço nem fechamento)", () => {
    const mins = generateSlots(rules({ durationMin: 60 })).map((s) => s.startMin);
    expect(mins).not.toContain(11 * 60 + 30);
    expect(mins).toContain(11 * 60);
    expect(mins.at(-1)).toBe(17 * 60);
  });

  it("impede sobreposição com atendimentos existentes", () => {
    const busy = [{ start: zonedToUtc(DATE, 10 * 60, TZ), end: zonedToUtc(DATE, 10 * 60 + 45, TZ) }];
    const mins = generateSlots(rules({ busy })).map((s) => s.startMin);
    expect(mins).not.toContain(600);
    expect(mins).not.toContain(630);
    expect(mins).toContain(570); // 09:30–10:00 encosta mas não sobrepõe
    expect(mins).toContain(660);
  });

  it("aplica pausa entre atendimentos (buffer)", () => {
    const busy = [{ start: zonedToUtc(DATE, 10 * 60, TZ), end: zonedToUtc(DATE, 10 * 60 + 30, TZ) }];
    const mins = generateSlots(rules({ busy, bufferMin: 15, stepMin: 15 })).map((s) => s.startMin);
    expect(mins).not.toContain(9 * 60 + 30); // 09:30 + 30min + 15 buffer invade 10:00
    expect(mins).toContain(9 * 60 + 15);
  });

  it("respeita folgas e bloqueios", () => {
    const timeOff = [{ start: zonedToUtc(DATE, 14 * 60, TZ), end: zonedToUtc(DATE, 16 * 60, TZ) }];
    const mins = generateSlots(rules({ timeOff })).map((s) => s.startMin);
    expect(mins.filter((m) => m >= 840 && m < 960)).toHaveLength(0);
    expect(mins).toContain(960);
  });

  it("feriado, barbearia fechada e profissional sem jornada não geram horários", () => {
    expect(generateSlots(rules({ isHoliday: true }))).toHaveLength(0);
    expect(generateSlots(rules({ shopHours: null }))).toHaveLength(0);
    expect(generateSlots(rules({ working: null }))).toHaveLength(0);
  });

  it("respeita antecedência mínima e limite de agendamento futuro", () => {
    const sameDayNow = zonedToUtc(DATE, 10 * 60 + 10, TZ);
    const mins = generateSlots(rules({ now: sameDayNow, minAdvanceMinutes: 60 })).map((s) => s.startMin);
    expect(mins[0]).toBe(11 * 60 + 30);
    expect(generateSlots(rules({ maxAdvanceDays: 3 }))).toHaveLength(0);
    expect(generateSlots(rules({ now: zonedToUtc("2026-12-09", 8 * 60, TZ) }))).toHaveLength(0); // data passada
  });

  it("intersecta horário da barbearia com a jornada do profissional", () => {
    const mins = generateSlots(rules({ working: { startMin: 13 * 60, endMin: 20 * 60 } })).map((s) => s.startMin);
    expect(mins[0]).toBe(780);
    expect(mins.at(-1)).toBe(17 * 60 + 30);
  });

  it("unidades de trava cobrem todo o intervalo em blocos de 5 minutos", () => {
    const start = zonedToUtc(DATE, 600, TZ);
    const units = slotUnits(start, new Date(start.getTime() + 45 * 60000));
    expect(units).toHaveLength(9);
    expect(units[0].getTime()).toBe(start.getTime());
  });
});
