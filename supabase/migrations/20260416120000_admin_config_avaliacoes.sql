-- Migration: Create config_plataforma and avaliacoes_admin tables

-- ══════════════════════════════════════════════════════════
-- 1) config_plataforma – general platform configuration
-- ══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.config_plataforma (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  taxa_semanal_motorista numeric(10,2) NOT NULL DEFAULT 0,
  nome_plataforma text NOT NULL DEFAULT 'RF Drive',
  telefone_suporte text DEFAULT '',
  horario_funcionamento_inicio text DEFAULT '06:00',
  horario_funcionamento_fim text DEFAULT '22:00',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.config_plataforma ENABLE ROW LEVEL SECURITY;

-- Allow all access (app uses anon key with custom auth)
DROP POLICY IF EXISTS "config_plataforma_admin_read" ON public.config_plataforma;
DROP POLICY IF EXISTS "config_plataforma_admin_write" ON public.config_plataforma;
DROP POLICY IF EXISTS "config_plataforma_all" ON public.config_plataforma;
CREATE POLICY "config_plataforma_all" ON public.config_plataforma FOR ALL USING (true) WITH CHECK (true);

-- Insert default row if empty
INSERT INTO public.config_plataforma (taxa_semanal_motorista)
SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM public.config_plataforma LIMIT 1);

-- ══════════════════════════════════════════════════════════
-- 2) avaliacoes_admin – admin evaluations of drivers
-- ══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.avaliacoes_admin (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  motorista_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  nota smallint NOT NULL CHECK (nota >= 1 AND nota <= 5),
  comentario text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_avaliacoes_admin_motorista ON public.avaliacoes_admin(motorista_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_admin_created ON public.avaliacoes_admin(created_at DESC);

ALTER TABLE public.avaliacoes_admin ENABLE ROW LEVEL SECURITY;

-- Allow all access (app uses anon key with custom auth)
DROP POLICY IF EXISTS "avaliacoes_admin_read" ON public.avaliacoes_admin;
DROP POLICY IF EXISTS "avaliacoes_admin_write" ON public.avaliacoes_admin;
DROP POLICY IF EXISTS "avaliacoes_admin_all" ON public.avaliacoes_admin;
CREATE POLICY "avaliacoes_admin_all" ON public.avaliacoes_admin FOR ALL USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════════════════
-- 3) GRANTs + Schema Cache Reload
-- ══════════════════════════════════════════════════════════
GRANT ALL ON public.config_plataforma TO anon, authenticated;
GRANT ALL ON public.avaliacoes_admin TO anon, authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
