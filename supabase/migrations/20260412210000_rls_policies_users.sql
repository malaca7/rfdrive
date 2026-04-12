-- Habilita RLS na tabela users (caso não esteja)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Qualquer pessoa pode criar conta (INSERT público para registro)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public can register' AND tablename = 'users'
  ) THEN
    CREATE POLICY "Public can register"
      ON public.users FOR INSERT
      WITH CHECK (true);
  END IF;
END$$;

-- Qualquer pessoa pode fazer login (SELECT público para autenticação por telefone+senha)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public can login' AND tablename = 'users'
  ) THEN
    CREATE POLICY "Public can login"
      ON public.users FOR SELECT
      USING (true);
  END IF;
END$$;
