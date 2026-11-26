# Arquitetura e status

## Stack

| Camada | Escolha | Observação |
|---|---|---|
| Web | Next.js 15 (App Router), React 19, TypeScript, Tailwind 4 | Server Components + Server Actions |
| 3D | three 0.187, @react-three/fiber 9, @react-three/drei 10 | Carregado sob demanda (`next/dynamic`, sem SSR) |
| Dados | Prisma 6 — SQLite em dev, PostgreSQL/Supabase em produção | Mesmo schema; troca só o `provider` |
| Validação | Zod (no servidor, em toda entrada) | |
| Testes | Vitest (unitários + integração com banco real) | |

A autenticação é própria (bcrypt + sessões no banco), o banco é acessado via Prisma e os componentes de interface são próprios. As migrações para Supabase Postgres estão em `supabase/migrations/`. Supabase Auth não é utilizado.

## Organização

```
src/
  app/                 rotas (público, /cliente, /barbeiro, /admin, /api)
  components/3d/       cena: Environment, Station, CameraRig, texturas e materiais procedurais
  components/ui/       primitivos, toasts, diálogos, gráficos
  components/layout/   shells e navegação
  features/            UI por domínio (appointments, barbershop-3d, partners, finance…)
  server/services/     REGRAS DE NEGÓCIO (sem dependência do Next) — testadas diretamente
  server/actions/      Server Actions finas: sessão → Actor → serviço
  server/auth/         hash, tokens, sessões
  lib/                 fuso horário, dinheiro, CSV
  types/domain.ts      papéis, estados e rótulos
prisma/schema.prisma   modelo de dados
supabase/migrations/   SQL para Postgres + RLS
supabase/seed/         dados de demonstração
tests/unit, tests/integration
```

## Decisões principais

- **Permissões no servidor.** Toda operação recebe um `Actor` (usuário, barbearia, papéis, perfil de barbeiro aprovado) e verifica o acesso em `server/services`. A interface só esconde botões. Um barbeiro só conta como barbeiro se tiver o papel `BARBER` **e** o perfil `APPROVED`.
- **Sem cadastro público de administrador.** O primeiro proprietário nasce em `/setup` (exige `SETUP_TOKEN`, roda uma vez) ou no seed de dev. Só um administrador concede `ADMIN`.
- **Anti-conflito de horários no banco.** Cada atendimento grava suas unidades de 5 minutos em `AppointmentSlot`, com `UNIQUE(barbeiro, unidade)`. Reservas concorrentes no mesmo intervalo: uma confirma e as outras recebem "horário acabou de ser reservado". Testado com 3 reservas simultâneas. Em Postgres também há uma restrição `EXCLUDE USING gist`.
- **Fuso.** Tudo é armazenado em UTC. Agenda e exibição usam `America/Sao_Paulo` (`src/lib/time.ts`).
- **Estações 3D são dados.** `Station` guarda o ponto (`spotKey`), a rotação, o modelo, a cor, o status ativo e o barbeiro. As edições ficam em `draftJson` até a publicação. Os pontos seguros e os ajustes de giro limitados (`features/barbershop-3d/layout.ts`) evitam colisões e a obstrução da circulação. Há 6 pontos; o editor avisa quando acabam.
- **Estados das estações** vêm da agenda real da data escolhida: disponível, sem horários, profissional indisponível (folga/férias/não atende), inativa, vaga.
- **Comissões imutáveis.** Na conclusão do atendimento, um snapshot da regra é gravado em `Commission`. Mudar a regra não recalcula valores fechados.
- **Notificações com outbox.** Registro in-app + `NotificationDelivery` por canal, com `dedupeKey` único (sem duplicatas). Sem provedor configurado, a entrega fica `SKIPPED` com o motivo; nunca é marcada como enviada.
- **3D sem downloads.** Modelos procedurais (móveis com cantos arredondados, cadeiras capitonê, espelhos em arco) e texturas geradas em canvas: zero assets externos. Pós-processamento (oclusão ambiente N8AO, bloom, tone mapping ACES, vinheta, SMAA) e sombras de contato nos níveis alto/equilibrado. Há qualidade adaptativa (`PerformanceMonitor`, com escolha manual), um fallback 2D completo (sem WebGL, dispositivo fraco, erro de contexto ou escolha do usuário) e suporte a `prefers-reduced-motion`.
- **Rótulos 3D em HTML próprio.** Os nomes sobre as cadeiras são botões HTML que a cena reposiciona a cada quadro (`LabelProjector`). Isso substitui o `<Html>` do drei, que gerava erros com React 19.

## Segurança e LGPD

bcrypt (custo 12); sessões em cookie httpOnly/SameSite=Lax/Secure com token aleatório (só o hash SHA-256 fica no banco); rate limiting persistido (login, cadastro, recuperação, reservas, upload); validação Zod; upload validado pela assinatura binária; cabeçalhos de segurança; auditoria das ações administrativas; recuperação de senha com token de uso único que encerra as sessões; exportação dos dados do titular (JSON); exclusão de conta por anonimização (o histórico financeiro é preservado); consentimento de canais (e-mail/WhatsApp) e de compartilhamento de preferências. RLS no Supabase bloqueia `anon`/`authenticated` (o navegador nunca acessa o banco diretamente).

## Testes executados

`npm test` executa 42 testes em 4 arquivos:

- Unitários: motor de disponibilidade (almoço, duração, sobreposição, pausa, folga, feriado, antecedência, limite futuro, interseção de horários, fuso) e comissões (3 modelos, arredondamento, limites).
- Integração (banco real): reserva persistida; **concorrência** (3 reservas simultâneas → 1 confirmada; intervalos sobrepostos com inícios diferentes); duplicidade e liberação após cancelamento; remarcação revalidada; isolamento entre clientes; política de cancelamento; folga; feriado; comissão com snapshot; transições inválidas; as **5 jornadas**; editor 3D (rascunho invisível até publicar, sobreposição, falta de espaço, estação com reservas não pode ser removida, desativação, placa); pagamentos (barbeiro → pendente, dono → confirmado), repasses e dupla quitação; desligamento com cancelamento e com redistribuição; setup único; recuperação de senha; fila sem duplicatas.

Ainda não há testes E2E automatizados em navegador nem validação em aparelhos físicos.

## Pronto

Autenticação e papéis · cadastro de cliente e de barbeiro · aprovação, rejeição e complementação de parceiros · convites · troca de perfil · serviços e categorias · preço, duração e comissão por profissional · jornada, intervalos, folgas, férias e bloqueios (com aprovação) · feriados · motor de reservas transacional · remarcar, cancelar e estados com histórico · painéis do cliente, do barbeiro e do proprietário · cena 3D com fachada, recepção, espera e estações completas · câmera (geral, planta, ambientes, foco na cadeira, sem atravessar paredes) · hover e seleção · editor de layout com prévia e publicação · fallback 2D · financeiro manual, comissões, repasses e CSV · notificações in-app + outbox · LGPD (exportar/excluir) · auditoria.

## Pendências e evoluções

- **Integrações externas (código pronto, não verificado sem credenciais):** e-mail via Resend e WhatsApp Cloud API. O WhatsApp de verdade exige templates aprovados pela Meta; o código atual envia texto simples (só funciona dentro da janela de 24h).
- **Pagamentos online:** não implementados (ver PAGAMENTOS.md).
- **Lembretes automáticos:** exigem agendar a chamada de `/api/cron/notifications`.
- **Supabase Auth / Storage:** não usados. O upload grava em disco (`UPLOAD_DIR`); para hospedagem serverless, trocar `src/server/storage.ts` por Supabase Storage.
- Temas 3D adicionais (Industrial, Minimalista, Clássico), editor livre de móveis, modelos GLB reais, avaliações, fidelidade, múltiplas unidades (o schema já tem `shopId` em tudo), app nativo.
- Testes E2E (Playwright) e auditoria de acessibilidade com leitor de tela.
- O `reactStrictMode` continua desativado. Ele foi desligado por causa do `<Html>` do drei, que já não é usado; reativar exige um novo teste da cena.
