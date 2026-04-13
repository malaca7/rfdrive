-- =============================================================
-- LocaliZZou MVP - Consolidated Schema
-- Tables: users, corridas
-- Auth: app-level (phone + password in public.users)
-- =============================================================

-- Users table
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  telefone text NOT NULL UNIQUE,
  senha text NOT NULL,
  tipo text NOT NULL DEFAULT 'cliente' CHECK (tipo IN ('cliente', 'motorista', 'admin')),
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'banido')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Corridas table
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

-- RLS (permissive for MVP — auth is app-level, not Supabase Auth)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corridas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_all_access" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "corridas_all_access" ON public.corridas FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime for corridas
ALTER PUBLICATION supabase_realtime ADD TABLE public.corridas;