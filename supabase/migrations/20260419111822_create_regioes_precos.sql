-- Regioes gerenciaveis para classificacao da tabela de precos
CREATE TABLE IF NOT EXISTS public.regioes_precos (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	nome text NOT NULL UNIQUE,
	ativo boolean NOT NULL DEFAULT true,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.update_regioes_precos_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	NEW.updated_at = now();
	RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_regioes_precos_updated_at ON public.regioes_precos;
CREATE TRIGGER trg_regioes_precos_updated_at
BEFORE UPDATE ON public.regioes_precos
FOR EACH ROW
EXECUTE FUNCTION public.update_regioes_precos_updated_at();

CREATE INDEX IF NOT EXISTS idx_regioes_precos_nome ON public.regioes_precos (nome);
CREATE INDEX IF NOT EXISTS idx_regioes_precos_ativo ON public.regioes_precos (ativo);

-- Seed inicial baseado nas regioes ja existentes na tabela de precos
INSERT INTO public.regioes_precos (nome)
SELECT DISTINCT trim(tp.regiao)
FROM public.tabela_precos tp
WHERE tp.regiao IS NOT NULL
	AND trim(tp.regiao) <> ''
ON CONFLICT (nome) DO NOTHING;

ALTER TABLE public.regioes_precos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "regioes_precos_all_access" ON public.regioes_precos;
CREATE POLICY "regioes_precos_all_access" ON public.regioes_precos
FOR ALL
USING (true)
WITH CHECK (true);

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_publication_rel pr
		JOIN pg_class c ON pr.prrelid = c.oid
		JOIN pg_publication p ON pr.prpubid = p.oid
		WHERE c.relname = 'regioes_precos' AND p.pubname = 'supabase_realtime'
	) THEN
		ALTER PUBLICATION supabase_realtime ADD TABLE public.regioes_precos;
	END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
