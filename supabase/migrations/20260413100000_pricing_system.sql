-- ══════════════════════════════════════════════════════════
-- Sistema de Precificação Dinâmica por Localidade
-- Tabelas: localidades, precos_rotas, regras_horario, historico_precos
-- ══════════════════════════════════════════════════════════

-- ── Localidades (hierarquia infinita) ──
CREATE TABLE IF NOT EXISTS localidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'bairro' CHECK (tipo IN ('bairro', 'local', 'rua', 'ponto', 'cidade', 'zona')),
  parent_id UUID REFERENCES localidades(id) ON DELETE SET NULL,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_localidades_parent ON localidades(parent_id);
CREATE INDEX idx_localidades_tipo ON localidades(tipo);
CREATE INDEX idx_localidades_ativo ON localidades(ativo);
CREATE INDEX idx_localidades_nome ON localidades(nome);

-- ── Preços de Rotas (matriz origem x destino) ──
CREATE TABLE IF NOT EXISTS precos_rotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origem_id UUID NOT NULL REFERENCES localidades(id) ON DELETE CASCADE,
  destino_id UUID NOT NULL REFERENCES localidades(id) ON DELETE CASCADE,
  preco_fixo NUMERIC(10,2),
  preco_minimo NUMERIC(10,2),
  prioridade INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_preco_rota UNIQUE(origem_id, destino_id)
);

CREATE INDEX idx_precos_rotas_origem ON precos_rotas(origem_id);
CREATE INDEX idx_precos_rotas_destino ON precos_rotas(destino_id);
CREATE INDEX idx_precos_rotas_ativo ON precos_rotas(ativo);
CREATE INDEX idx_precos_rotas_prioridade ON precos_rotas(prioridade DESC);

-- ── Regras de Horário (preço dinâmico) ──
CREATE TABLE IF NOT EXISTS regras_horario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  tipo_ajuste TEXT NOT NULL DEFAULT 'percentual' CHECK (tipo_ajuste IN ('percentual', 'fixo')),
  valor_ajuste NUMERIC(10,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_regras_horario_ativo ON regras_horario(ativo);

-- ── Histórico de Preços (log de cálculos) ──
CREATE TABLE IF NOT EXISTS historico_precos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  corrida_id UUID REFERENCES corridas(id) ON DELETE SET NULL,
  origem_localidade_id UUID REFERENCES localidades(id) ON DELETE SET NULL,
  destino_localidade_id UUID REFERENCES localidades(id) ON DELETE SET NULL,
  preco_rota_id UUID REFERENCES precos_rotas(id) ON DELETE SET NULL,
  regra_horario_id UUID REFERENCES regras_horario(id) ON DELETE SET NULL,
  preco_base NUMERIC(10,2),
  ajuste_aplicado TEXT,
  preco_final NUMERIC(10,2) NOT NULL,
  origem_regra TEXT,
  detalhes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_historico_precos_corrida ON historico_precos(corrida_id);

-- ── Adicionar campos de precificação à tabela corridas ──
ALTER TABLE corridas ADD COLUMN IF NOT EXISTS preco_regra_aplicada TEXT;
ALTER TABLE corridas ADD COLUMN IF NOT EXISTS preco_detalhes JSONB;

-- ── RLS (permissivo, segurança app-level como resto do sistema) ──
ALTER TABLE localidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE precos_rotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE regras_horario ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico_precos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "localidades_all" ON localidades FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "precos_rotas_all" ON precos_rotas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "regras_horario_all" ON regras_horario FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "historico_precos_all" ON historico_precos FOR ALL USING (true) WITH CHECK (true);

-- ── Realtime ──
ALTER PUBLICATION supabase_realtime ADD TABLE localidades;
ALTER PUBLICATION supabase_realtime ADD TABLE precos_rotas;
ALTER PUBLICATION supabase_realtime ADD TABLE regras_horario;

-- ── GRANTs (anon key auth) ──
GRANT ALL ON public.localidades TO anon, authenticated;
GRANT ALL ON public.precos_rotas TO anon, authenticated;
GRANT ALL ON public.regras_horario TO anon, authenticated;
GRANT ALL ON public.historico_precos TO anon, authenticated;
GRANT ALL ON public.corridas TO anon, authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
