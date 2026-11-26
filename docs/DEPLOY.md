# Publicação

## 1. Banco (Supabase PostgreSQL)

1. Crie um projeto no Supabase (região `sa-east-1`).
2. Em `prisma/schema.prisma`, troque `provider = "sqlite"` por `provider = "postgresql"` e acrescente `directUrl = env("DIRECT_URL")` ao bloco `datasource`.
3. Remova a pasta `prisma/migrations` (ela é específica do SQLite) e gere a migração de Postgres:
   ```powershell
   npx prisma migrate dev --name init
   ```
   Outra opção é aplicar `supabase/migrations/20261119000000_init.sql` no SQL Editor.
4. Aplique `supabase/migrations/20261119000100_security_rls.sql` (RLS, restrição anti-sobreposição e índices).
5. Variáveis: `DATABASE_URL` (pooler, porta 6543, `?pgbouncer=true`) e `DIRECT_URL` (porta 5432).

## 2. Variáveis de ambiente

Veja `.env.example`. Obrigatórias em produção: `DATABASE_URL`, `APP_URL`, `SHOP_SLUG`, `SETUP_TOKEN` (longo e aleatório), `CRON_SECRET`. Opcionais: `RESEND_API_KEY` + `EMAIL_FROM`, `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID`.

## 3. Hospedagem

**Servidor Node (VPS, Railway, Render):** `npm ci && npm run build && npx prisma migrate deploy && npm start`. Mantenha `UPLOAD_DIR` em um volume persistente.

**Vercel:** funciona, mas o disco é efêmero. Substitua `src/server/storage.ts` por Supabase Storage (bucket público `uploads`) antes de publicar, ou as fotos se perdem.

## 4. Primeiro acesso

Abra `https://seu-dominio/setup`, informe o `SETUP_TOKEN` e crie a barbearia + proprietário. A rota se desativa sozinha. **Não rode o seed em produção** (ele é bloqueado).

## 5. Notificações e lembretes

Agende a cada 10 minutos:
```
GET https://seu-dominio/api/cron/notifications
Authorization: Bearer <CRON_SECRET>
```
(Vercel Cron, GitHub Actions, cron-job.org ou crontab.)

## 6. Checklist

- [ ] HTTPS ativo (cookies `Secure`)
- [ ] `SETUP_TOKEN` e `CRON_SECRET` fortes
- [ ] Backups automáticos do Postgres
- [ ] Política de privacidade revisada juridicamente (`/privacidade` é um modelo)
- [ ] Domínio verificado no provedor de e-mail
