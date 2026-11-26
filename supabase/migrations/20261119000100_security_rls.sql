-- ─────────────────────────────────────────────────────────────────────────────
-- BARBERVERSE 3D — segurança no banco (Supabase)
--
-- Arquitetura: o navegador NUNCA acessa o banco diretamente. Toda leitura e
-- escrita passa pelo servidor Next.js (Server Actions / Route Handlers), que
-- se conecta com uma credencial de servidor (DATABASE_URL, papel "postgres")
-- e aplica autenticação, papéis e regras de negócio.
--
-- Como defesa em profundidade, habilitamos RLS em TODAS as tabelas sem
-- políticas para os papéis "anon" e "authenticated" do Supabase. Resultado:
-- mesmo que a chave pública (anon key) vaze, a API REST/GraphQL do Supabase
-- não consegue ler nem alterar nenhum dado.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    -- RLS ligado e nenhuma política: anon/authenticated não veem nenhuma linha.
    -- O dono das tabelas (papel do servidor) não é afetado (RLS não forçado).
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t.tablename);
  END LOOP;
END $$;

-- ─── Garantia extra contra sobreposição de horários ─────────────────────────
-- A aplicação já impede conflitos pela tabela "AppointmentSlot" (UNIQUE por
-- barbeiro + unidade de 5 min). Em PostgreSQL adicionamos também uma
-- restrição de exclusão sobre o intervalo do atendimento.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public."Appointment"
  ADD CONSTRAINT appointment_no_overlap
  EXCLUDE USING gist (
    "barberProfileId" WITH =,
    tsrange("startsAt", "endsAt", '[)') WITH &&
  )
  WHERE (status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW'));

-- Índices úteis para relatórios
CREATE INDEX IF NOT EXISTS appointment_status_idx ON public."Appointment" ("shopId", status, "startsAt");
CREATE INDEX IF NOT EXISTS payment_status_idx ON public."Payment" (status);
