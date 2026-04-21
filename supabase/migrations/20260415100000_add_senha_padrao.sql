-- Add senha_padrao column to config_plataforma
ALTER TABLE public.config_plataforma ADD COLUMN IF NOT EXISTS senha_padrao text NOT NULL DEFAULT '123456';
