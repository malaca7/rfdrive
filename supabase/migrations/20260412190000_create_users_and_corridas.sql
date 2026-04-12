-- Tabela principal de usuários administrativos e de login
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text NOT NULL UNIQUE,
  senha text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('cliente', 'motorista', 'admin')),
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'banido')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela de corridas
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
