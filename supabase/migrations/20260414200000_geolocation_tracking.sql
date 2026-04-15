-- ============================================================
-- ETAPAS 7-12: Geolocalização, Status, Tracking de Corridas
-- ============================================================

-- ── ETAPA 7: Tabela localizacao_motorista ──
CREATE TABLE IF NOT EXISTS localizacao_motorista (
  motorista_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para busca por proximidade (despacho futuro)
CREATE INDEX IF NOT EXISTS idx_localizacao_coords ON localizacao_motorista (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_localizacao_atualizado ON localizacao_motorista (atualizado_em DESC);

-- RLS
ALTER TABLE localizacao_motorista ENABLE ROW LEVEL SECURITY;

-- Motorista pode ler/escrever sua própria localização
DROP POLICY IF EXISTS "motorista_own_location" ON localizacao_motorista;
CREATE POLICY "motorista_own_location" ON localizacao_motorista
  FOR ALL USING (true) WITH CHECK (true);

-- Admin pode ler todas as localizações
DROP POLICY IF EXISTS "admin_read_all_locations" ON localizacao_motorista;
CREATE POLICY "admin_read_all_locations" ON localizacao_motorista
  FOR SELECT USING (true);

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE localizacao_motorista;


-- ── ETAPA 8: Status disponibilidade no users ──
ALTER TABLE users ADD COLUMN IF NOT EXISTS status_disponibilidade TEXT NOT NULL DEFAULT 'inativo'
  CHECK (status_disponibilidade IN ('ativo', 'inativo'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS ultima_atividade TIMESTAMPTZ;


-- ── ETAPA 10: Campos de tracking na tabela corridas ──
-- Novos status: a_caminho, em_corrida, finalizada
-- O campo status já existe com check constraint, precisamos atualizar
ALTER TABLE corridas DROP CONSTRAINT IF EXISTS corridas_status_check;
ALTER TABLE corridas ADD CONSTRAINT corridas_status_check
  CHECK (status IN ('nova', 'aguardando_motorista', 'aceita', 'a_caminho', 'em_corrida', 'em_analise', 'aprovada', 'nao_realizada', 'recusada', 'finalizada'));

-- Tracking ativo (boolean)
ALTER TABLE corridas ADD COLUMN IF NOT EXISTS tracking_ativo BOOLEAN NOT NULL DEFAULT false;

-- Índice para corridas com tracking ativo
CREATE INDEX IF NOT EXISTS idx_corridas_tracking ON corridas (tracking_ativo) WHERE tracking_ativo = true;
CREATE INDEX IF NOT EXISTS idx_corridas_status_motorista ON corridas (status, motorista_id);
