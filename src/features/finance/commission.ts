/**
 * Cálculo de comissão (função pura).
 *
 * PERCENT      → percentual único do profissional sobre o valor do serviço.
 * PER_SERVICE  → percentual específico do serviço (BarberService.commissionPercent),
 *                com o percentual geral do profissional como padrão.
 * FIXED        → parceria com valor fixo: o valor dos serviços fica com o
 *                profissional (100%) e a obrigação fixa (ex.: aluguel de
 *                cadeira) é registrada separadamente em fixedFeeCents.
 */
import type { CommissionModel } from "@/types/domain";

export interface CommissionInput {
  model: CommissionModel;
  baseCents: number;
  barberPercent: number;
  servicePercent?: number | null;
}

export interface CommissionResult {
  percent: number;
  amountCents: number;
  shopShareCents: number;
  explanation: string;
}

export function computeCommission(input: CommissionInput): CommissionResult {
  if (!Number.isInteger(input.baseCents) || input.baseCents < 0) throw new Error("Valor base inválido");
  let percent: number;
  let explanation: string;
  switch (input.model) {
    case "PER_SERVICE":
      percent = input.servicePercent ?? input.barberPercent;
      explanation =
        input.servicePercent != null
          ? `Comissão específica do serviço: ${percent}%`
          : `Serviço sem percentual próprio — usado o padrão do profissional: ${percent}%`;
      break;
    case "FIXED":
      percent = 100;
      explanation = "Parceria com valor fixo: valor integral do serviço ao profissional; obrigação fixa registrada à parte";
      break;
    case "PERCENT":
    default:
      percent = input.barberPercent;
      explanation = `Comissionado: ${percent}% do valor do serviço`;
  }
  if (percent < 0 || percent > 100) throw new Error("Percentual de comissão fora do intervalo 0–100");
  const amountCents = Math.round((input.baseCents * percent) / 100);
  return { percent, amountCents, shopShareCents: input.baseCents - amountCents, explanation };
}
