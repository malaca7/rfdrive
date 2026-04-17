-- Add button color configuration columns
ALTER TABLE config_plataforma
  ADD COLUMN IF NOT EXISTS cor_botao_texto TEXT DEFAULT '#0a0a0a',
  ADD COLUMN IF NOT EXISTS cor_botao_fundo TEXT DEFAULT '#FFD000',
  ADD COLUMN IF NOT EXISTS cor_botao_borda TEXT DEFAULT '#FFD000',
  ADD COLUMN IF NOT EXISTS botao_borda_ativa BOOLEAN DEFAULT true;
