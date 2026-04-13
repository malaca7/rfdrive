-- Fix: Ensure vehicle columns exist + GRANT + schema reload
-- Fixes: "Could not find the 'veiculo_cor' column of 'users' in the schema cache"

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS veiculo_marca TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS veiculo_modelo TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS veiculo_cor TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS veiculo_placa TEXT DEFAULT NULL;

-- Ensure RLS explicit policies for users
DROP POLICY IF EXISTS "users_all_access" ON public.users;
DROP POLICY IF EXISTS "users_select" ON public.users;
DROP POLICY IF EXISTS "users_insert" ON public.users;
DROP POLICY IF EXISTS "users_update" ON public.users;
DROP POLICY IF EXISTS "users_delete" ON public.users;

CREATE POLICY "users_select" ON public.users FOR SELECT USING (true);
CREATE POLICY "users_insert" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "users_update" ON public.users FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "users_delete" ON public.users FOR DELETE USING (true);

GRANT ALL ON public.users TO anon, authenticated;

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
