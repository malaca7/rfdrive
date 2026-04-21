-- Add numeric code for regions (display: "codigo - nome")
CREATE SEQUENCE IF NOT EXISTS public.regioes_precos_codigo_seq;

ALTER TABLE public.regioes_precos
ADD COLUMN IF NOT EXISTS codigo integer;

ALTER TABLE public.regioes_precos
ALTER COLUMN codigo SET DEFAULT nextval('public.regioes_precos_codigo_seq');

-- Backfill existing rows preserving creation order
WITH ordered AS (
	SELECT id, row_number() OVER (ORDER BY created_at, nome) AS rn
	FROM public.regioes_precos
	WHERE codigo IS NULL
)
UPDATE public.regioes_precos rp
SET codigo = ordered.rn
FROM ordered
WHERE rp.id = ordered.id;

-- Ensure sequence continues after max assigned codigo
SELECT setval(
	'public.regioes_precos_codigo_seq',
	GREATEST((SELECT COALESCE(MAX(codigo), 0) FROM public.regioes_precos), 1),
	true
);

ALTER TABLE public.regioes_precos
ALTER COLUMN codigo SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_regioes_precos_codigo ON public.regioes_precos (codigo);

NOTIFY pgrst, 'reload schema';
