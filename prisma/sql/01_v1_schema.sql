-- ===========================================================================
-- Remus ERP — Versão 1 (Núcleo operacional)
-- Tabelas: customer, product_category, product, stock_movement
-- Evoluções em: auth_user, auth_role, auth_permission
--
-- Script idempotente: pode ser executado mais de uma vez com segurança.
-- Execute no SQL Editor do Supabase (ou `psql -f`) ANTES de usar as telas.
-- Depois rode `02_v1_seed_rbac.sql` para criar papéis e permissões.
-- ===========================================================================

-- gen_random_uuid() — nativo no Postgres 13+; no Supabase já vem habilitado.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Tipos enumerados
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('ACTIVE', 'INACTIVE', 'INVITED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE person_type AS ENUM ('INDIVIDUAL', 'COMPANY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE customer_status AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE product_status AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE stock_movement_type AS ENUM ('IN', 'OUT', 'ADJUSTMENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 2. Evolução das tabelas de autenticação já existentes
-- ---------------------------------------------------------------------------

-- auth_user: último acesso (coluna da lista de usuários) e status de convite.
ALTER TABLE auth_user ADD COLUMN IF NOT EXISTS last_login_at timestamp(3);
ALTER TABLE auth_user ADD COLUMN IF NOT EXISTS status user_status NOT NULL DEFAULT 'ACTIVE';

-- auth_role: papéis de sistema (globais) vs. papéis customizados por empresa.
ALTER TABLE auth_role ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE auth_role ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;
ALTER TABLE auth_role ADD COLUMN IF NOT EXISTS enterprise_id uuid;

DO $$ BEGIN
  ALTER TABLE auth_role
    ADD CONSTRAINT auth_role_enterprise_id_fkey
    FOREIGN KEY (enterprise_id) REFERENCES remus_enterprise (id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- auth_permission: o código vira "modulo.acao" e ganha colunas derivadas,
-- usadas pela matriz de permissões (módulo x ação) da tela de Papéis.
ALTER TABLE auth_permission ADD COLUMN IF NOT EXISTS module text;
ALTER TABLE auth_permission ADD COLUMN IF NOT EXISTS action text;
ALTER TABLE auth_permission ADD COLUMN IF NOT EXISTS description text;

UPDATE auth_permission
   SET module = COALESCE(module, NULLIF(split_part(code, '.', 1), '')),
       action = COALESCE(action, NULLIF(split_part(code, '.', 2), ''))
 WHERE module IS NULL OR action IS NULL;

-- Remove permissões legadas cujo código não segue "modulo.acao" e que, por
-- isso, não conseguiriam preencher module/action. Sem isso o SET NOT NULL
-- abaixo falharia. Se você tiver códigos legados a preservar, ajuste aqui.
DELETE FROM auth_role_permission
 WHERE "permissionId" IN (SELECT id FROM auth_permission WHERE module IS NULL OR action IS NULL);
DELETE FROM auth_permission WHERE module IS NULL OR action IS NULL;

ALTER TABLE auth_permission ALTER COLUMN module SET NOT NULL;
ALTER TABLE auth_permission ALTER COLUMN action SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS auth_permission_code_key ON auth_permission (code);

-- ---------------------------------------------------------------------------
-- 3. customer
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS customer (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id uuid NOT NULL REFERENCES remus_enterprise (id),
  name          text NOT NULL,
  person_type   person_type NOT NULL DEFAULT 'COMPANY',
  document      text,
  email         text,
  phone         text,
  zip_code      text,
  street        text,
  number        text,
  complement    text,
  district      text,
  city          text,
  state         varchar(2),
  notes         text,
  status        customer_status NOT NULL DEFAULT 'ACTIVE',
  created_at    timestamp(3) NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES auth_user (id),
  updated_at    timestamp(3) NOT NULL DEFAULT now(),
  deleted_at    timestamp(3),
  deleted_by    uuid REFERENCES auth_user (id)
);

CREATE INDEX IF NOT EXISTS customer_enterprise_deleted_idx ON customer (enterprise_id, deleted_at);
CREATE INDEX IF NOT EXISTS customer_enterprise_status_idx  ON customer (enterprise_id, status);

-- Documento único por empresa, ignorando registros excluídos (soft delete) e
-- clientes sem documento informado.
CREATE UNIQUE INDEX IF NOT EXISTS customer_enterprise_document_key
  ON customer (enterprise_id, document)
  WHERE deleted_at IS NULL AND document IS NOT NULL;

-- Busca por nome/documento/email sem depender de índice de texto completo.
CREATE INDEX IF NOT EXISTS customer_name_lower_idx ON customer (lower(name));

-- ---------------------------------------------------------------------------
-- 4. product_category
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS product_category (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id uuid NOT NULL REFERENCES remus_enterprise (id),
  name          text NOT NULL,
  created_at    timestamp(3) NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES auth_user (id),
  deleted_at    timestamp(3),
  deleted_by    uuid REFERENCES auth_user (id)
);

CREATE INDEX IF NOT EXISTS product_category_enterprise_deleted_idx
  ON product_category (enterprise_id, deleted_at);

CREATE UNIQUE INDEX IF NOT EXISTS product_category_enterprise_name_key
  ON product_category (enterprise_id, lower(name))
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 5. product
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS product (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id uuid NOT NULL REFERENCES remus_enterprise (id),
  name          text NOT NULL,
  sku           text NOT NULL,
  category_id   uuid REFERENCES product_category (id),
  unit          text NOT NULL DEFAULT 'UN',
  cost_price    numeric(14, 2) NOT NULL DEFAULT 0,
  sale_price    numeric(14, 2) NOT NULL DEFAULT 0,
  min_stock     numeric(14, 3) NOT NULL DEFAULT 0,
  max_stock     numeric(14, 3),
  description   text,
  status        product_status NOT NULL DEFAULT 'ACTIVE',
  created_at    timestamp(3) NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES auth_user (id),
  updated_at    timestamp(3) NOT NULL DEFAULT now(),
  deleted_at    timestamp(3),
  deleted_by    uuid REFERENCES auth_user (id)
);

CREATE INDEX IF NOT EXISTS product_enterprise_deleted_idx  ON product (enterprise_id, deleted_at);
CREATE INDEX IF NOT EXISTS product_enterprise_category_idx ON product (enterprise_id, category_id);
CREATE INDEX IF NOT EXISTS product_name_lower_idx          ON product (lower(name));

-- SKU único por empresa, ignorando registros excluídos.
CREATE UNIQUE INDEX IF NOT EXISTS product_enterprise_sku_key
  ON product (enterprise_id, lower(sku))
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 6. stock_movement  (append-only — o saldo é sempre derivado desta tabela)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS stock_movement (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id uuid NOT NULL REFERENCES remus_enterprise (id),
  product_id    uuid NOT NULL REFERENCES product (id),
  type          stock_movement_type NOT NULL,
  quantity      numeric(14, 3) NOT NULL,
  reason        text,
  reference     text,
  created_at    timestamp(3) NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES auth_user (id),

  -- Entradas e saídas são sempre positivas; o sinal vem do `type`.
  -- Ajustes podem ser negativos (correção para baixo).
  CONSTRAINT stock_movement_quantity_check CHECK (
    (type IN ('IN', 'OUT') AND quantity > 0) OR
    (type = 'ADJUSTMENT' AND quantity <> 0)
  )
);

CREATE INDEX IF NOT EXISTS stock_movement_product_idx
  ON stock_movement (enterprise_id, product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stock_movement_created_idx
  ON stock_movement (enterprise_id, created_at DESC);

-- A trilha de auditoria do estoque só é íntegra se as linhas forem imutáveis.
-- Corrigir um erro = inserir um ajuste, nunca editar/apagar o lançamento.
CREATE OR REPLACE FUNCTION stock_movement_is_append_only()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'stock_movement é append-only: registre um ajuste em vez de alterar ou excluir o lançamento %', OLD.id;
END $$;

DROP TRIGGER IF EXISTS stock_movement_no_update_delete ON stock_movement;
CREATE TRIGGER stock_movement_no_update_delete
  BEFORE UPDATE OR DELETE ON stock_movement
  FOR EACH ROW EXECUTE FUNCTION stock_movement_is_append_only();

-- ---------------------------------------------------------------------------
-- 7. Saldo de estoque — view agregada (nunca uma coluna materializada)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW stock_balance AS
SELECT
  p.id            AS product_id,
  p.enterprise_id,
  COALESCE(SUM(
    CASE m.type
      WHEN 'IN'         THEN  m.quantity
      WHEN 'OUT'        THEN -m.quantity
      WHEN 'ADJUSTMENT' THEN  m.quantity
    END
  ), 0) AS quantity
FROM product p
LEFT JOIN stock_movement m ON m.product_id = p.id
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.enterprise_id;
