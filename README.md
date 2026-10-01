# Remus ERP

ERP SaaS multi-tenant para pequenas e médias empresas: clientes, catálogo de
produtos, estoque por movimentações e controle de acesso por papéis.

O plano completo do produto está em [`documentation/Roadmap_ERP_SaaS.md`](documentation/Roadmap_ERP_SaaS.md).
Este README cobre o que já está construído e como rodar.

## Stack

| Camada | Escolha |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) + TypeScript |
| UI | MUI v9 + Emotion, `@mui/x-data-grid`, `@mui/x-charts`, `@iconify/react` |
| Formulários | react-hook-form + Zod |
| Dados | Prisma 7 + `@prisma/adapter-pg` sobre PostgreSQL (Supabase) |
| Autenticação | NextAuth (Credentials, JWT) + bcryptjs |
| i18n | next-intl (`pt` padrão, `en`) |

## Como rodar

### 1. Variáveis de ambiente

Crie um `.env` na raiz:

```env
DATABASE_URL="postgresql://usuario:senha@host:5432/postgres"
NEXTAUTH_SECRET="uma-string-aleatoria-longa"
NEXTAUTH_URL="http://localhost:3000"
```

### 2. Dependências

```bash
pnpm install
pnpm exec prisma generate
```

### 3. Banco de dados

Os scripts em `prisma/sql/` são idempotentes e devem rodar **em ordem**:

```bash
node scripts/run-sql.mjs \
  prisma/sql/01_v1_schema.sql \
  prisma/sql/02_v1_seed_rbac.sql \
  prisma/sql/03_v1_bootstrap.sql \
  prisma/sql/04_v1_developer_tenancy.sql
```

| Script | O que faz |
|---|---|
| `01_v1_schema.sql` | Tipos, tabelas (`customer`, `product_category`, `product`, `stock_movement`), índices, a view `stock_balance` e o trigger que torna `stock_movement` append-only |
| `02_v1_seed_rbac.sql` | Catálogo de permissões e os cinco papéis de sistema |
| `03_v1_bootstrap.sql` | Cria a primeira empresa e vincula usuários órfãos |
| `04_v1_developer_tenancy.sql` | Desvincula contas `isDeveloper` de qualquer empresa |

> Este projeto **não usa `prisma migrate`**. O schema é aplicado por SQL
> explícito porque as tabelas de autenticação já existiam no banco e porque
> índices únicos parciais (`WHERE deleted_at IS NULL`) não são expressáveis no
> schema do Prisma.

### 4. Dados de demonstração (opcional)

```bash
node scripts/seed-demo.mjs          # 25 produtos, 15 clientes, ~90 dias de movimentações
node scripts/seed-demo.mjs --clean  # remove apenas o que foi semeado
```

Sem isso o sistema funciona, mas todas as telas abrem no estado vazio.

### 5. Subir

```bash
pnpm dev     # http://localhost:3000
```

## Conceitos que explicam o código

**Multi-tenant.** Toda tabela de negócio tem `enterprise_id`. O `enterpriseId`
vem **sempre** da sessão no servidor (`src/lib/server/session.ts`), nunca do
cliente. As mutações usam `updateMany` com o filtro de empresa, de modo que um
id de outro tenant simplesmente não encontra nada em vez de afetar o registro
alheio.

**Contas de desenvolvedor.** `auth_user.enterprise_id` é nulo apenas para
contas `isDeveloper`, que não pertencem a nenhum tenant e escolhem a empresa
ativa pelo seletor da navbar (cookie `remus.enterprise`, validado no servidor).
Um usuário comum fica preso à própria empresa e o cookie é ignorado na leitura.

**RBAC.** As permissões (`modulo.acao`) são lidas do banco a cada requisição,
não do JWT — revogar um papel vale na hora. No cliente, `useAccess().can(...)`
esconde ou desabilita a ação; no servidor, `requirePermission(...)` é quem de
fato autoriza.

**Estoque por movimentação.** O saldo é sempre derivado da soma de
`stock_movement` (`src/lib/server/stock.ts`), nunca de uma coluna de
quantidade. Um trigger no banco rejeita `UPDATE` e `DELETE` na tabela:
corrigir um erro é lançar um ajuste, o que mantém a trilha de auditoria
íntegra.

**Exclusão.** Sempre soft delete (`deleted_at`), o que permite o "Desfazer" do
toast depois de excluir.

**Erros.** Server actions nunca lançam para a tela: devolvem
`{ ok: false, error: 'chaveDeTraducao' }` e, em falha de validação, um
`fieldErrors` que o formulário usa para marcar o campo certo.

## Organização

```
src/
  app/[locale]/dashboard/   # rotas (wrappers finos sobre os módulos)
  components/               # DataTable, StatCard, ChartCard, FormDrawer, ...
  layouts/dashboard/        # navbar, sidebar, seletor de empresa
  lib/server/               # sessão, permissões, saldo de estoque, action()
  modules/<modulo>/
    actions/                # server actions + schemas Zod
    components/             # telas do módulo
    hooks/                  # busca de dados
    types.ts
```

Cada módulo segue o mesmo formato. `modules/customers/` é a referência: ao
criar um módulo novo, copie a estrutura dele.

## Scripts

```bash
pnpm dev                       # servidor de desenvolvimento
pnpm build                     # build de produção
pnpm lint                      # eslint
node scripts/run-sql.mjs <f>   # aplica .sql em transação
node scripts/seed-demo.mjs     # dados de demonstração
node scripts/verify-e2e.mjs    # verificação ponta a ponta (Playwright)
```

`verify-e2e.mjs` cria um usuário temporário, percorre todas as telas em um
Chromium headless, confere que as listas trazem dados, que a validação de
documento recusa um CPF inválido, que a conta de desenvolvedor não vaza para o
tenant e que não há erro de console — e remove o usuário no final. Exige o
servidor de dev no ar.

## Estado atual

**Versão 1 — pronta.** Autenticação, multi-tenancy, RBAC, Painel, Clientes,
Produtos, Estoque e Usuários & Papéis.

**Versão 2 — pendente.** Ordens de Serviço (Kanban), Financeiro, Auditoria.

**Versão 3 — pendente.** Relatórios, Notificações, anexos, busca global.

Veja [`CHANGELOG.md`](CHANGELOG.md).
