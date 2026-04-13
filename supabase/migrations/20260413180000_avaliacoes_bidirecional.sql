-- =============================================
-- AVALIAÇÕES BIDIRECIONAIS (cliente↔motorista)
-- =============================================

-- Adicionar coluna tipo para distinguir quem avaliou
ALTER TABLE public.avaliacoes ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'cliente';

-- Remover constraint antiga (1 avaliação por corrida)
ALTER TABLE public.avaliacoes DROP CONSTRAINT IF EXISTS avaliacoes_corrida_id_key;

-- Nova constraint: 1 avaliação por corrida POR TIPO
ALTER TABLE public.avaliacoes ADD CONSTRAINT avaliacoes_corrida_tipo_unique UNIQUE(corrida_id, tipo);

-- Índice para tipo
CREATE INDEX IF NOT EXISTS idx_avaliacoes_tipo ON public.avaliacoes(tipo);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_cliente ON public.avaliacoes(cliente_id);

-- Atualizar RLS: motorista também pode inserir
DO $$ BEGIN
  DROP POLICY IF EXISTS "cliente_insere_avaliacao" ON public.avaliacoes;
  DROP POLICY IF EXISTS "todos_veem_avaliacoes" ON public.avaliacoes;
  DROP POLICY IF EXISTS "avaliacoes_insert" ON public.avaliacoes;
  DROP POLICY IF EXISTS "avaliacoes_select" ON public.avaliacoes;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "avaliacoes_insert" ON public.avaliacoes FOR INSERT WITH CHECK (true);
CREATE POLICY "avaliacoes_select" ON public.avaliacoes FOR SELECT USING (true);

-- Grants
GRANT ALL ON public.avaliacoes TO anon, authenticated;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
