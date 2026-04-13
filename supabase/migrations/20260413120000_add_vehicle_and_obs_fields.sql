-- ══════════════════════════════════════════════════════════
-- Adicionar campos de veículo em users e observação do cliente em corridas
-- ══════════════════════════════════════════════════════════

-- Campos de veículo do motorista
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS veiculo_marca TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS veiculo_modelo TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS veiculo_cor TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS veiculo_placa TEXT DEFAULT NULL;

-- Observação do cliente na solicitação
ALTER TABLE public.corridas
  ADD COLUMN IF NOT EXISTS observacao_cliente TEXT DEFAULT NULL;
