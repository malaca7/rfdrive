-- Add slogan column to config_plataforma
ALTER TABLE public.config_plataforma ADD COLUMN IF NOT EXISTS slogan text DEFAULT 'Seu transporte inteligente';

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
