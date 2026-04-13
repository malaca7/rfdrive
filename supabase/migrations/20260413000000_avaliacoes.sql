-- =============================================
-- AVALIAÇÕES DE MOTORISTAS PELOS PASSAGEIROS
-- =============================================

CREATE TABLE IF NOT EXISTS public.avaliacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corrida_id uuid NOT NULL REFERENCES public.corridas(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  motorista_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  nota smallint NOT NULL CHECK (nota >= 1 AND nota <= 5),
  comentario text DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(corrida_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_avaliacoes_motorista ON public.avaliacoes(motorista_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_corrida ON public.avaliacoes(corrida_id);

-- RLS
ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;

-- Cliente pode inserir avaliação para suas corridas
CREATE POLICY "cliente_insere_avaliacao"
  ON public.avaliacoes FOR INSERT
  WITH CHECK (true);

-- Todos podem ver avaliações
CREATE POLICY "todos_veem_avaliacoes"
  ON public.avaliacoes FOR SELECT
  USING (true);
