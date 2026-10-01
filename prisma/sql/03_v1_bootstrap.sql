-- ===========================================================================
-- Remus ERP — Bootstrap do primeiro tenant (V1)
--
-- Execute DEPOIS de `01_v1_schema.sql` e `02_v1_seed_rbac.sql`.
--
-- Por que este script existe: `auth_user.enterprise_id` e `auth_user.role_id`
-- estavam NULL no banco, mas o schema do Prisma os declara obrigatórios — e
-- toda consulta do ERP é filtrada por `enterprise_id`. Sem empresa e papel o
-- usuário loga mas não enxerga nada. Aqui a gente fecha essa lacuna e alinha
-- o banco ao schema.
--
-- Idempotente: se já houver empresa e os usuários já estiverem vinculados,
-- reexecutar não muda nada.
-- ===========================================================================

DO $$
DECLARE
  v_enterprise_id uuid;
  v_first_user_id uuid;
  v_admin_role_id uuid := '00000000-0000-4000-8000-000000000001';
BEGIN
  SELECT id INTO v_first_user_id FROM auth_user ORDER BY created_at LIMIT 1;

  IF v_first_user_id IS NULL THEN
    RAISE NOTICE 'Nenhum usuário em auth_user — nada a fazer.';
    RETURN;
  END IF;

  -- 1. Garante uma empresa (o primeiro usuário é o dono).
  SELECT id INTO v_enterprise_id
    FROM remus_enterprise
   WHERE deleted_at IS NULL
   ORDER BY created_at
   LIMIT 1;

  IF v_enterprise_id IS NULL THEN
    v_enterprise_id := gen_random_uuid();
    INSERT INTO remus_enterprise (id, name, created_at, created_by)
    VALUES (v_enterprise_id, 'Minha empresa', now(), v_first_user_id);
    RAISE NOTICE 'Empresa criada: %', v_enterprise_id;
  END IF;

  -- 2. Vincula usuários órfãos à empresa e dá papel de Administrador a quem
  --    ainda não tem papel (o primeiro acesso precisa conseguir administrar).
  UPDATE auth_user SET enterprise_id = v_enterprise_id WHERE enterprise_id IS NULL;
  UPDATE auth_user SET role_id = v_admin_role_id WHERE role_id IS NULL;
  UPDATE auth_user SET status = 'ACTIVE' WHERE status IS NULL;
END $$;

-- 3. Alinha o banco ao schema do Prisma (que já tratava estes campos como
--    obrigatórios). Roda só depois do backfill acima.
ALTER TABLE auth_user ALTER COLUMN enterprise_id SET NOT NULL;
ALTER TABLE auth_user ALTER COLUMN role_id SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE auth_user
    ADD CONSTRAINT auth_user_role_id_fkey
    FOREIGN KEY (role_id) REFERENCES auth_role (id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE auth_user
    ADD CONSTRAINT auth_user_enterprise_id_fkey
    FOREIGN KEY (enterprise_id) REFERENCES remus_enterprise (id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
