-- ================================================================
-- Config Plataforma: dados da empresa para recibos e cabeçalhos
-- ================================================================

ALTER TABLE public.config_plataforma
  ADD COLUMN IF NOT EXISTS razao_social text,
  ADD COLUMN IF NOT EXISTS nome_fantasia text,
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS inscricao_municipal text,
  ADD COLUMN IF NOT EXISTS email_empresa text,
  ADD COLUMN IF NOT EXISTS telefone_empresa text,
  ADD COLUMN IF NOT EXISTS endereco_empresa text;

CREATE INDEX IF NOT EXISTS idx_config_plataforma_cnpj
  ON public.config_plataforma (cnpj);

NOTIFY pgrst, 'reload schema';
