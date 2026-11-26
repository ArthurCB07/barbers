import { describe, expect, it } from "vitest";
import { computeCommission } from "@/features/finance/commission";
import { parseMoneyToCents, csvEscape } from "@/lib/utils";

describe("cálculo de comissões", () => {
  it("modelo comissionado: R$ 50,00 a 50% → R$ 25,00", () => {
    const r = computeCommission({ model: "PERCENT", baseCents: 5000, barberPercent: 50 });
    expect(r.amountCents).toBe(2500);
    expect(r.shopShareCents).toBe(2500);
  });

  it("comissão por serviço usa o percentual do serviço", () => {
    expect(computeCommission({ model: "PER_SERVICE", baseCents: 8000, barberPercent: 50, servicePercent: 60 }).amountCents).toBe(4800);
  });

  it("comissão por serviço sem percentual próprio usa o padrão do profissional", () => {
    const r = computeCommission({ model: "PER_SERVICE", baseCents: 8000, barberPercent: 40, servicePercent: null });
    expect(r.percent).toBe(40);
    expect(r.amountCents).toBe(3200);
  });

  it("parceria fixa: serviço integral ao profissional", () => {
    const r = computeCommission({ model: "FIXED", baseCents: 6000, barberPercent: 50 });
    expect(r.amountCents).toBe(6000);
    expect(r.shopShareCents).toBe(0);
  });

  it("arredonda centavos corretamente", () => {
    expect(computeCommission({ model: "PERCENT", baseCents: 4990, barberPercent: 45 }).amountCents).toBe(2246);
  });

  it("rejeita percentuais inválidos", () => {
    expect(() => computeCommission({ model: "PERCENT", baseCents: 1000, barberPercent: 120 })).toThrow();
  });
});

describe("utilitários financeiros", () => {
  it("converte valores em reais para centavos", () => {
    expect(parseMoneyToCents("49,90")).toBe(4990);
    expect(parseMoneyToCents("R$ 1.250,00")).toBe(125000);
    expect(parseMoneyToCents("35")).toBe(3500);
  });
  it("neutraliza injeção de fórmula em CSV", () => {
    expect(csvEscape("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
  });
});
