-- Adiciona campos opcionais de cliente ao evaluation_links
ALTER TABLE evaluation_links
  ADD COLUMN IF NOT EXISTS cliente_nome     text,
  ADD COLUMN IF NOT EXISTS cliente_telefone text;
