# Barberverse 3D

Plataforma de barbearia com **ambiente 3D navegável** (Three.js / React Three Fiber) integrado a um sistema real de **agendamentos, equipe, comissões e financeiro**. Clientes, barbeiros e proprietário usam a mesma aplicação, cada um com sua interface e suas permissões.

## Início rápido (desenvolvimento)

Requisitos: Node.js 20+ (testado com 26.13).

```powershell
npm install
Copy-Item .env.example .env
npx prisma migrate dev
npm run db:seed
npm run dev
```

Abra http://localhost:3000. O seed cria a barbearia de demonstração, o proprietário (que também é o barbeiro inicial, na Estação 01), um cliente e um candidato a barbeiro pendente. As credenciais de demonstração estão no cabeçalho de [`supabase/seed/seed.ts`](supabase/seed/seed.ts).

> O npm 11 bloqueia scripts de instalação. Se o Prisma reclamar que o client não foi gerado, rode `npm install-scripts approve prisma @prisma/client @prisma/engines esbuild` e depois `npx prisma generate`.

Sem seed (como em produção): abra `/setup` e informe o `SETUP_TOKEN` do `.env` para criar a barbearia e o primeiro proprietário. A rota se desativa depois disso.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build e execução de produção |
| `npm test` | Testes unitários + integração (banco SQLite isolado `prisma/test.db`) |
| `npm run lint` | Checagem de tipos (`tsc --noEmit`) |
| `npm run db:seed` | Dados de demonstração (bloqueado em produção) |
| `npm run notifications:run` | Processa a fila de notificações e gera lembretes |

## Jornadas

1. **Novo cliente** — "Sou cliente" → cadastro → barbearia 3D → clique na cadeira → serviço → data → horário livre → confirmação → "Meus agendamentos".
2. **Novo barbeiro** — "Sou barbeiro" → cadastro + perfil profissional → "aguardando aprovação" → proprietário aprova em *Solicitações de Parceiros* (comissão, serviços, estação) → aparece na cena 3D → acessa sua agenda.
3. **Crescimento** — *Minha Barbearia 3D*: adicionar estação num ponto livre, girar, escolher modelo, vincular profissional, prévia 3D ao vivo → **Publicar**. Ou *Equipe e Parceiros → + Adicionar Barbeiro*, que gera um convite seguro.
4. **Administração** — dashboard com filtros e gráficos, agenda geral, pagamentos presenciais, comissões, repasses, CSV.
5. **Alternância de perfis** — "Trocar perfil" (barra lateral) entre Cliente, Barbeiro e Dono.

## Documentação

- [docs/ARQUITETURA.md](docs/ARQUITETURA.md) — decisões técnicas, modelo de dados, segurança, o que está pronto e o que falta
- [docs/DEPLOY.md](docs/DEPLOY.md) — publicação (Supabase Postgres + Vercel ou servidor Node)
- [docs/PAGAMENTOS.md](docs/PAGAMENTOS.md) — como o financeiro funciona hoje e como integrar Pix/Mercado Pago
