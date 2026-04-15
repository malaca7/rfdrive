-- Adicionar campos de data às regras de horário
-- Permite definir período de vigência ou deixar a regra "sempre ativa"
ALTER TABLE regras_horario ADD COLUMN IF NOT EXISTS data_inicio DATE;
ALTER TABLE regras_horario ADD COLUMN IF NOT EXISTS data_fim DATE;
