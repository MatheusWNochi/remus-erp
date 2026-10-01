-- ===========================================================================
-- Remus ERP — Permissões e papéis de sistema (V1)
--
-- Execute DEPOIS de `01_v1_schema.sql`.
-- Idempotente: reexecutar re-sincroniza os papéis de sistema com a matriz
-- abaixo. Papéis customizados por empresa (enterprise_id IS NOT NULL) nunca
-- são tocados por este script.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Catálogo de permissões (módulo x ação)
-- ---------------------------------------------------------------------------

INSERT INTO auth_permission (id, code, module, action, description) VALUES
  (gen_random_uuid(), 'dashboard.view',   'dashboard', 'view',   'Ver o painel'),

  (gen_random_uuid(), 'customers.view',   'customers', 'view',   'Ver clientes'),
  (gen_random_uuid(), 'customers.create', 'customers', 'create', 'Criar clientes'),
  (gen_random_uuid(), 'customers.edit',   'customers', 'edit',   'Editar clientes'),
  (gen_random_uuid(), 'customers.delete', 'customers', 'delete', 'Excluir clientes'),
  (gen_random_uuid(), 'customers.export', 'customers', 'export', 'Exportar clientes'),

  (gen_random_uuid(), 'products.view',    'products',  'view',   'Ver produtos'),
  (gen_random_uuid(), 'products.create',  'products',  'create', 'Criar produtos'),
  (gen_random_uuid(), 'products.edit',    'products',  'edit',   'Editar produtos'),
  (gen_random_uuid(), 'products.delete',  'products',  'delete', 'Excluir produtos'),
  (gen_random_uuid(), 'products.export',  'products',  'export', 'Exportar produtos'),

  (gen_random_uuid(), 'inventory.view',   'inventory', 'view',   'Ver estoque'),
  (gen_random_uuid(), 'inventory.create', 'inventory', 'create', 'Registrar movimentações'),
  (gen_random_uuid(), 'inventory.export', 'inventory', 'export', 'Exportar estoque'),

  (gen_random_uuid(), 'users.view',       'users',     'view',   'Ver usuários'),
  (gen_random_uuid(), 'users.create',     'users',     'create', 'Convidar usuários'),
  (gen_random_uuid(), 'users.edit',       'users',     'edit',   'Editar usuários'),
  (gen_random_uuid(), 'users.delete',     'users',     'delete', 'Desativar usuários'),

  (gen_random_uuid(), 'roles.view',       'roles',     'view',   'Ver papéis e permissões'),
  (gen_random_uuid(), 'roles.edit',       'roles',     'edit',   'Editar papéis e permissões')
ON CONFLICT (code) DO UPDATE
  SET module      = EXCLUDED.module,
      action      = EXCLUDED.action,
      description = EXCLUDED.description;

-- ---------------------------------------------------------------------------
-- 2. Papéis de sistema (globais, não editáveis na interface)
-- ---------------------------------------------------------------------------

INSERT INTO auth_role (id, name, description, is_system, enterprise_id) VALUES
  ('00000000-0000-4000-8000-000000000001', 'Administrador', 'Acesso total, incluindo usuários e permissões', true, NULL),
  ('00000000-0000-4000-8000-000000000002', 'Gerente',       'Operação completa, sem gestão de usuários',      true, NULL),
  ('00000000-0000-4000-8000-000000000003', 'Operador',      'Operação do dia a dia, sem exclusões',           true, NULL),
  ('00000000-0000-4000-8000-000000000004', 'Financeiro',    'Leitura operacional e relatórios financeiros',   true, NULL),
  ('00000000-0000-4000-8000-000000000005', 'Leitura',       'Somente visualização',                           true, NULL)
ON CONFLICT (id) DO UPDATE
  SET name        = EXCLUDED.name,
      description = EXCLUDED.description,
      is_system   = true;

-- ---------------------------------------------------------------------------
-- 3. Matriz papel x permissão (somente papéis de sistema)
-- ---------------------------------------------------------------------------

DELETE FROM auth_role_permission
 WHERE "roleId" IN (SELECT id FROM auth_role WHERE is_system);

-- Administrador: tudo.
INSERT INTO auth_role_permission ("roleId", "permissionId")
SELECT '00000000-0000-4000-8000-000000000001', id FROM auth_permission;

-- Gerente: operação completa, sem usuários/papéis.
INSERT INTO auth_role_permission ("roleId", "permissionId")
SELECT '00000000-0000-4000-8000-000000000002', id FROM auth_permission
 WHERE module IN ('dashboard', 'customers', 'products', 'inventory');

-- Operador: cria e edita, mas não exclui nem exporta.
INSERT INTO auth_role_permission ("roleId", "permissionId")
SELECT '00000000-0000-4000-8000-000000000003', id FROM auth_permission
 WHERE code IN (
   'dashboard.view',
   'customers.view', 'customers.create', 'customers.edit',
   'products.view',
   'inventory.view', 'inventory.create'
 );

-- Financeiro: leitura operacional + exportações.
INSERT INTO auth_role_permission ("roleId", "permissionId")
SELECT '00000000-0000-4000-8000-000000000004', id FROM auth_permission
 WHERE code IN (
   'dashboard.view',
   'customers.view', 'customers.export',
   'products.view', 'products.export',
   'inventory.view', 'inventory.export'
 );

-- Leitura: apenas visualização.
INSERT INTO auth_role_permission ("roleId", "permissionId")
SELECT '00000000-0000-4000-8000-000000000005', id FROM auth_permission
 WHERE action = 'view';

-- ---------------------------------------------------------------------------
-- 4. Promova o seu usuário a Administrador
--
-- Sem isto nenhuma tela aparece: o menu e os botões são montados a partir das
-- permissões do papel do usuário. Troque o e-mail e rode a linha abaixo.
-- ---------------------------------------------------------------------------

-- UPDATE auth_user
--    SET role_id = '00000000-0000-4000-8000-000000000001'
--  WHERE email = 'seu-email@exemplo.com';
