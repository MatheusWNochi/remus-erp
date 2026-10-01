# Changelog

## [1.0.0] — Versão 1: núcleo operacional

Primeira versão funcional: o ciclo cadastrar → filtrar → detalhar → agir está
completo em todos os módulos do núcleo.

### Painel
- KPIs de clientes ativos, produtos no catálogo, itens com estoque baixo e
  valor em estoque, cada um com variação vs. o mês anterior e link para a
  lista que origina o número.
- Gráfico de entradas x saídas com período selecionável (7d / 30d / 12m),
  donut de estoque por categoria, barras de Top 5 produtos e lista de
  atividade recente.
- Alerta de estoque abaixo do mínimo com atalho para o estoque filtrado.

### Clientes
- Listagem com busca, filtros por status e UF, ordenação e paginação no
  servidor, seleção múltipla, exportação CSV e ações em massa.
- Criação e edição em drawer, com máscara e validação de dígito verificador de
  CPF/CNPJ.
- Tela de detalhe com dados cadastrais, endereço e ações de editar, ativar/
  inativar e excluir.
- Exclusão com confirmação nomeando o cliente e "Desfazer" no toast.

### Produtos
- Listagem com margem calculada, barra de estoque atual vs. mínimo colorida
  por situação, filtros por categoria, status e "somente estoque baixo".
- Categorias com criação inline no próprio formulário e geração automática de
  SKU.
- Tela de detalhe com histórico de movimentações em gráfico.
- Excluir um produto com saldo em estoque exige confirmação explícita.

### Estoque
- Saldo por produto derivado das movimentações, classificado em normal, baixo,
  zerado ou excesso.
- Registro de movimentação (entrada, saída, ajuste) com saldo atual e saldo
  resultante exibidos antes de confirmar; saída que deixaria o saldo negativo
  é recusada.
- Histórico filtrável por produto, tipo e período, e painel lateral com o
  histórico individual do produto.
- KPIs e gráfico de entradas x saídas por período.

### Usuários & Papéis
- Listagem com papel, status e último acesso; convite de usuário e ativação/
  desativação.
- Matriz de permissões por módulo × ação; papéis de sistema são somente
  leitura.
- Alterar um papel para outro com menos permissões pede confirmação listando o
  que será perdido.
- Um usuário não pode desativar a si mesmo nem alterar o próprio papel
  (validado no servidor).

### Plataforma
- Multi-tenancy com `enterprise_id` em toda tabela de negócio, sempre
  resolvido no servidor a partir da sessão.
- Contas `isDeveloper` não pertencem a nenhuma empresa e trocam o tenant ativo
  por um seletor na navbar.
- RBAC lido do banco a cada requisição: revogar um papel vale imediatamente.
- `stock_movement` é append-only, garantido por trigger no banco.
- Soft delete em todas as entidades principais.
- Tema claro/escuro, navegação no topo ou lateral e seletor de idioma
  (pt-BR / en), incluindo os textos próprios do DataGrid.
- Verificação ponta a ponta com Playwright (`scripts/verify-e2e.mjs`).

### Banco de dados
- `prisma/sql/01_v1_schema.sql` — tabelas, índices, view `stock_balance` e
  trigger append-only.
- `prisma/sql/02_v1_seed_rbac.sql` — permissões e papéis de sistema.
- `prisma/sql/03_v1_bootstrap.sql` — primeira empresa e vínculo dos usuários.
- `prisma/sql/04_v1_developer_tenancy.sql` — contas de desenvolvedor sem
  empresa, com a integridade garantida por CHECK.

## Próximas versões

**Versão 2** — Ordens de Serviço (Kanban), Financeiro (contas a pagar/receber,
fluxo de caixa) e Auditoria.

**Versão 3** — Relatórios customizáveis, Notificações com realtime, anexos e
busca global (`Cmd/Ctrl+K`).
