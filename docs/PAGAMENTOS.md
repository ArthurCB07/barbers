# Pagamentos

## Hoje: registro manual e presencial

- O cliente paga na barbearia (dinheiro, Pix pelo QR da loja, maquininha).
- **Barbeiro** registra o recebimento → o pagamento fica `PENDING` (aguardando confirmação).
- **Proprietário** registra ou confirma → `CONFIRMED`, com `confirmedById` e `confirmedAt`.
- Todo pagamento é marcado `provider = "MANUAL"` e aparece como "Registro manual" no painel e no CSV.
- Pagamentos podem ser anulados (`VOIDED`) e cada ação entra na auditoria.

Nenhum pagamento é confirmado automaticamente e nenhum provedor online é simulado.

## Integração futura (Mercado Pago / Pix / cartão)

O modelo `Payment` já tem `provider`, `reference` e `status`. Passos sugeridos:

1. `POST /api/payments/checkout` cria uma preferência ou cobrança Pix no Mercado Pago (`MERCADOPAGO_ACCESS_TOKEN`) e grava um `Payment` `PENDING` com `provider = "MERCADOPAGO"` e `reference = id externo`.
2. `POST /api/payments/webhook` valida a assinatura do webhook, consulta o pagamento na API do provedor (nunca confie só no payload) e muda o status para `CONFIRMED` de forma idempotente (por `reference`).
3. Exibir o QR Pix / link de pagamento na confirmação do agendamento.

Até lá, o fluxo manual é o único método ativo.
