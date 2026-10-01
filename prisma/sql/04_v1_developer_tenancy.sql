-- ===========================================================================
-- Remus ERP — Contas de desenvolvedor não pertencem a uma empresa (V1)
--
-- Corrige `03_v1_bootstrap.sql`, que vinculava todo usuário a uma empresa e
-- tornava `auth_user.enterprise_id` obrigatório.
--
-- Regra correta:
--   • usuário comum  -> pertence a exatamente uma empresa (obrigatório);
--   • `isDeveloper`  -> não pertence a nenhuma, escolhe o tenant ativo pelo
--                       seletor de empresa da navbar.
--
-- Execute DEPOIS de `03_v1_bootstrap.sql`. Idempotente.
-- ===========================================================================

-- 1. Volta a permitir empresa nula (só faz sentido para desenvolvedores).
ALTER TABLE auth_user ALTER COLUMN enterprise_id DROP NOT NULL;

-- 2. Desvincula contas de desenvolvedor da empresa criada pelo bootstrap.
UPDATE auth_user SET enterprise_id = NULL WHERE "isDeveloper";

-- 3. Integridade: todo usuário comum precisa de empresa; desenvolvedor, não.
--    Isso mantém a garantia que o NOT NULL dava, sem prender o desenvolvedor
--    a um tenant.
DO $$ BEGIN
  ALTER TABLE auth_user
    ADD CONSTRAINT auth_user_enterprise_required_check
    CHECK ("isDeveloper" OR enterprise_id IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- A empresa "Minha empresa" criada pelo bootstrap é mantida de propósito: o
-- seletor de empresa precisa de pelo menos um tenant para operar. Renomeie-a
-- (ou crie outras) quando tiver os dados reais:
--
--   UPDATE remus_enterprise SET name = 'Nome real' WHERE name = 'Minha empresa';
