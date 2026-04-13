-- =============================================================
-- Fix: Drop Supabase Auth-based tables, keep only public.users + corridas
-- =============================================================

-- Drop old triggers that reference auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Drop old triggers
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_corridas_updated_at ON public.corridas;
DROP FUNCTION IF EXISTS public.update_updated_at_column();

-- Drop old function (CASCADE removes dependent policies)
DROP FUNCTION IF EXISTS public.has_role CASCADE;

-- Drop old RLS policies on corridas (they reference auth.uid)
DROP POLICY IF EXISTS "Clients can view own rides" ON public.corridas;
DROP POLICY IF EXISTS "Clients can create rides" ON public.corridas;
DROP POLICY IF EXISTS "Drivers can view pending rides" ON public.corridas;
DROP POLICY IF EXISTS "Drivers can view accepted rides" ON public.corridas;
DROP POLICY IF EXISTS "Drivers can accept pending rides" ON public.corridas;
DROP POLICY IF EXISTS "Admins can view all rides" ON public.corridas;
DROP POLICY IF EXISTS "Admins can update all rides" ON public.corridas;

-- Drop old corridas (references auth.users)
DROP TABLE IF EXISTS public.corridas CASCADE;

-- Drop Supabase Auth-based tables
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop old enums
DROP TYPE IF EXISTS public.app_role CASCADE;
DROP TYPE IF EXISTS public.user_status CASCADE;
DROP TYPE IF EXISTS public.ride_status CASCADE;

-- Ensure users table exists with correct schema
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  telefone text NOT NULL UNIQUE,
  senha text NOT NULL,
  tipo text NOT NULL DEFAULT 'cliente' CHECK (tipo IN ('cliente', 'motorista', 'admin')),
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'banido')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Recreate corridas referencing public.users
CREATE TABLE IF NOT EXISTS public.corridas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  motorista_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  origem_texto text NOT NULL,
  destino_texto text NOT NULL,
  horario_estimado text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aceita', 'concluida', 'rejeitada')),
  aprovado_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS (permissive for MVP — auth is app-level)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corridas ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Public can register" ON public.users;
DROP POLICY IF EXISTS "Public can login" ON public.users;
DROP POLICY IF EXISTS "users_all_access" ON public.users;
DROP POLICY IF EXISTS "corridas_all_access" ON public.corridas;

CREATE POLICY "users_all_access" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "corridas_all_access" ON public.corridas FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime for corridas (ignore if already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_class c ON pr.prrelid = c.oid
    JOIN pg_publication p ON pr.prpubid = p.oid
    WHERE c.relname = 'corridas' AND p.pubname = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.corridas;
  END IF;
END$$;
