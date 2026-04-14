-- ══════════════════════════════════════════════════════════
-- Configuração Global de Tarifas
-- Tabela singleton para configurações gerais de preço
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS config_tarifas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarifa_minima NUMERIC(10,2) NOT NULL DEFAULT 0,
  tarifa_base_km NUMERIC(10,2) NOT NULL DEFAULT 0,
  taxa_bagagem NUMERIC(10,2) NOT NULL DEFAULT 5.00,
  bandeirada NUMERIC(10,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inserir config padrão
INSERT INTO config_tarifas (tarifa_minima, tarifa_base_km, taxa_bagagem, bandeirada)
VALUES (0, 0, 5.00, 0)
ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE config_tarifas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "config_tarifas_select" ON config_tarifas FOR SELECT USING (true);
CREATE POLICY "config_tarifas_insert" ON config_tarifas FOR INSERT WITH CHECK (true);
CREATE POLICY "config_tarifas_update" ON config_tarifas FOR UPDATE USING (true);
CREATE POLICY "config_tarifas_delete" ON config_tarifas FOR DELETE USING (true);

GRANT ALL ON config_tarifas TO anon, authenticated;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE config_tarifas;

-- Forçar regras_horario para apenas percentual
ALTER TABLE regras_horario DROP CONSTRAINT IF EXISTS regras_horario_tipo_ajuste_check;
ALTER TABLE regras_horario ADD CONSTRAINT regras_horario_tipo_ajuste_check CHECK (tipo_ajuste = 'percentual');

-- Atualizar regras fixas existentes para percentual (converter valor fixo em ~0%)
UPDATE regras_horario SET tipo_ajuste = 'percentual' WHERE tipo_ajuste = 'fixo';
