-- Add new columns to corridas for driver features
ALTER TABLE public.corridas
  ADD COLUMN IF NOT EXISTS valor numeric(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS observacao_motorista text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS origem_editada text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS destino_editado text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS edicao_pendente boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS edicao_aprovada boolean DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS concluida_at timestamptz DEFAULT NULL;
