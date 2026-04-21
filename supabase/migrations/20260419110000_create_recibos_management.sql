-- Create receipts table for driver-generated service receipts
CREATE TABLE IF NOT EXISTS public.recibos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  motorista_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  numero text NOT NULL,
  token text NOT NULL UNIQUE,
  cliente_nome text,
  cliente_telefone text,
  origem text NOT NULL,
  destino text NOT NULL,
  valor_total numeric(10,2) NOT NULL,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'arquivado', 'cancelado')),
  observacao_admin text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Keep updated_at current on updates
CREATE OR REPLACE FUNCTION public.update_recibos_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recibos_updated_at ON public.recibos;
CREATE TRIGGER trg_recibos_updated_at
BEFORE UPDATE ON public.recibos
FOR EACH ROW
EXECUTE FUNCTION public.update_recibos_updated_at();

-- Useful indexes
CREATE INDEX IF NOT EXISTS idx_recibos_created_at ON public.recibos (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recibos_motorista_id ON public.recibos (motorista_id);
CREATE INDEX IF NOT EXISTS idx_recibos_status ON public.recibos (status);
CREATE INDEX IF NOT EXISTS idx_recibos_token ON public.recibos (token);

-- RLS (app currently uses app-level auth model)
ALTER TABLE public.recibos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recibos_all_access" ON public.recibos;
CREATE POLICY "recibos_all_access" ON public.recibos
FOR ALL
USING (true)
WITH CHECK (true);

-- Realtime support
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_rel pr
    JOIN pg_class c ON pr.prrelid = c.oid
    JOIN pg_publication p ON pr.prpubid = p.oid
    WHERE c.relname = 'recibos' AND p.pubname = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.recibos;
  END IF;
END;
$$;

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
