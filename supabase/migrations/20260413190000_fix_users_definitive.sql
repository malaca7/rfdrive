-- =============================================
-- FIX DEFINITIVO: users + todas as colunas
-- Execute no SQL Editor do Supabase
-- =============================================

-- Colunas de veículo
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS veiculo_marca TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS veiculo_modelo TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS veiculo_cor TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS veiculo_placa TEXT DEFAULT NULL;

-- Colunas de roles/status
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS roles TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true;

-- RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "users_all_access" ON public.users;
  DROP POLICY IF EXISTS "users_select" ON public.users;
  DROP POLICY IF EXISTS "users_insert" ON public.users;
  DROP POLICY IF EXISTS "users_update" ON public.users;
  DROP POLICY IF EXISTS "users_delete" ON public.users;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "users_select" ON public.users FOR SELECT USING (true);
CREATE POLICY "users_insert" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "users_update" ON public.users FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "users_delete" ON public.users FOR DELETE USING (true);

-- Grants
GRANT ALL ON public.users TO anon, authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Force reload
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
