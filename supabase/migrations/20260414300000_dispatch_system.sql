-- ═══════════════════════════════════════════════════════════════
-- Etapas 19-25 — Sistema de Despacho Automático de Corridas
-- ═══════════════════════════════════════════════════════════════

-- Tabela de ofertas de corrida para motoristas
CREATE TABLE IF NOT EXISTS ofertas_corrida (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  corrida_id UUID NOT NULL REFERENCES corridas(id) ON DELETE CASCADE,
  motorista_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'enviada'
    CHECK (status IN ('enviada', 'aceita', 'recusada', 'expirada', 'cancelada')),
  rodada_disparo INTEGER NOT NULL DEFAULT 1,
  score_ranking NUMERIC(8,2) DEFAULT NULL,
  distancia_km NUMERIC(8,2) DEFAULT NULL,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  respondido_em TIMESTAMPTZ DEFAULT NULL,
  tempo_resposta_segundos NUMERIC(8,2) DEFAULT NULL,
  motivo_rodada TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de métricas do motorista para ranking
CREATE TABLE IF NOT EXISTS metricas_motorista (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  motorista_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  media_tempo_aceite NUMERIC(8,2) DEFAULT 30,
  total_corridas_aceitas INTEGER DEFAULT 0,
  total_corridas_recusadas INTEGER DEFAULT 0,
  total_corridas_expiradas INTEGER DEFAULT 0,
  taxa_aceite NUMERIC(5,2) DEFAULT 0,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_ofertas_corrida_corrida ON ofertas_corrida(corrida_id);
CREATE INDEX IF NOT EXISTS idx_ofertas_corrida_motorista ON ofertas_corrida(motorista_id);
CREATE INDEX IF NOT EXISTS idx_ofertas_corrida_status ON ofertas_corrida(status);
CREATE INDEX IF NOT EXISTS idx_ofertas_corrida_rodada ON ofertas_corrida(corrida_id, rodada_disparo);
CREATE INDEX IF NOT EXISTS idx_ofertas_corrida_enviado ON ofertas_corrida(enviado_em);
CREATE INDEX IF NOT EXISTS idx_metricas_motorista_id ON metricas_motorista(motorista_id);

-- RLS
ALTER TABLE ofertas_corrida ENABLE ROW LEVEL SECURITY;
ALTER TABLE metricas_motorista ENABLE ROW LEVEL SECURITY;

-- Políticas para ofertas_corrida
CREATE POLICY "ofertas_read_own" ON ofertas_corrida
  FOR SELECT USING (
    motorista_id = current_setting('app.current_user_id', true)::uuid
    OR EXISTS (
      SELECT 1 FROM users
      WHERE id = current_setting('app.current_user_id', true)::uuid
      AND (tipo = 'admin' OR 'admin' = ANY(roles))
    )
  );

CREATE POLICY "ofertas_update_own" ON ofertas_corrida
  FOR UPDATE USING (
    motorista_id = current_setting('app.current_user_id', true)::uuid
  );

-- Para o sistema de dispatch (insert sem RLS restrictions)
CREATE POLICY "ofertas_insert_system" ON ofertas_corrida
  FOR INSERT WITH CHECK (true);

-- Políticas para metricas_motorista
CREATE POLICY "metricas_read_all" ON metricas_motorista
  FOR SELECT USING (true);

CREATE POLICY "metricas_upsert" ON metricas_motorista
  FOR ALL USING (true) WITH CHECK (true);

-- Função para atualizar métricas do motorista após resposta
CREATE OR REPLACE FUNCTION atualizar_metricas_motorista(p_motorista_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total_aceitas INTEGER;
  v_total_recusadas INTEGER;
  v_total_expiradas INTEGER;
  v_media_tempo NUMERIC;
  v_total INTEGER;
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN status = 'aceita' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status = 'recusada' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status = 'expirada' THEN 1 ELSE 0 END), 0),
    COALESCE(AVG(CASE WHEN status = 'aceita' AND tempo_resposta_segundos IS NOT NULL
                      THEN tempo_resposta_segundos END), 30)
  INTO v_total_aceitas, v_total_recusadas, v_total_expiradas, v_media_tempo
  FROM ofertas_corrida
  WHERE motorista_id = p_motorista_id;

  v_total := v_total_aceitas + v_total_recusadas + v_total_expiradas;

  INSERT INTO metricas_motorista (motorista_id, media_tempo_aceite, total_corridas_aceitas,
    total_corridas_recusadas, total_corridas_expiradas, taxa_aceite, atualizado_em)
  VALUES (
    p_motorista_id,
    v_media_tempo,
    v_total_aceitas,
    v_total_recusadas,
    v_total_expiradas,
    CASE WHEN v_total > 0 THEN (v_total_aceitas::NUMERIC / v_total) * 100 ELSE 0 END,
    now()
  )
  ON CONFLICT (motorista_id) DO UPDATE SET
    media_tempo_aceite = EXCLUDED.media_tempo_aceite,
    total_corridas_aceitas = EXCLUDED.total_corridas_aceitas,
    total_corridas_recusadas = EXCLUDED.total_corridas_recusadas,
    total_corridas_expiradas = EXCLUDED.total_corridas_expiradas,
    taxa_aceite = EXCLUDED.taxa_aceite,
    atualizado_em = now();
END;
$$ LANGUAGE plpgsql;
