-- ═══════════════════════════════════════════════════════════════
-- TABELA DE PREÇOS NO SUPABASE
-- Migra a TabelaRF (JSON estático) para Supabase,
-- permitindo CRUD admin + sincronização em tempo real
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tabela_precos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origem TEXT NOT NULL,
  destino TEXT NOT NULL,
  valor NUMERIC(10,2) NOT NULL,
  regiao TEXT NOT NULL DEFAULT 'Cabo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(origem, destino)
);

CREATE INDEX IF NOT EXISTS idx_tabela_precos_origem ON tabela_precos(origem);
CREATE INDEX IF NOT EXISTS idx_tabela_precos_destino ON tabela_precos(destino);

ALTER TABLE tabela_precos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tabela_precos_read" ON tabela_precos FOR SELECT USING (true);
CREATE POLICY "tabela_precos_write" ON tabela_precos FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE tabela_precos;
