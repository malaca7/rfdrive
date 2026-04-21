ALTER TABLE public.config_tarifas
ADD COLUMN IF NOT EXISTS valor_minuto_espera numeric(10,2) NOT NULL DEFAULT 0.50;

UPDATE public.config_tarifas
SET valor_minuto_espera = 0.50
WHERE valor_minuto_espera IS NULL OR valor_minuto_espera <= 0;

NOTIFY pgrst, 'reload schema';
