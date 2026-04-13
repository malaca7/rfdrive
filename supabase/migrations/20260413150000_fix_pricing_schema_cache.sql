-- ═══════════════════════════════════════════════════════════════
-- FIX: Pricing system tables - explicit RLS + schema cache reload
-- Fixes: "Could not find the table 'public.regras_horario' in the schema cache"
-- Fixes: editing precos_rotas/regras_horario not saving
-- ═══════════════════════════════════════════════════════════════

-- ── Ensure tables exist (idempotent) ──
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

CREATE TABLE IF NOT EXISTS precos_rotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origem_id UUID REFERENCES localidades(id) ON DELETE CASCADE NOT NULL,
  destino_id UUID REFERENCES localidades(id) ON DELETE CASCADE NOT NULL,
  preco_fixo NUMERIC(10,2),
  preco_minimo NUMERIC(10,2),
  prioridade INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

-- ── Enable RLS ──
ALTER TABLE localidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE precos_rotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE regras_horario ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico_precos ENABLE ROW LEVEL SECURITY;
ALTER TABLE tabela_precos ENABLE ROW LEVEL SECURITY;

-- ── Drop old generic policies ──
DROP POLICY IF EXISTS "localidades_all" ON localidades;
DROP POLICY IF EXISTS "precos_rotas_all" ON precos_rotas;
DROP POLICY IF EXISTS "regras_horario_all" ON regras_horario;
DROP POLICY IF EXISTS "historico_precos_all" ON historico_precos;
DROP POLICY IF EXISTS "tabela_precos_read" ON tabela_precos;
DROP POLICY IF EXISTS "tabela_precos_write" ON tabela_precos;

-- Drop any explicit split policies from previous fix migration
DROP POLICY IF EXISTS "localidades_select" ON localidades;
DROP POLICY IF EXISTS "localidades_insert" ON localidades;
DROP POLICY IF EXISTS "localidades_update" ON localidades;
DROP POLICY IF EXISTS "localidades_delete" ON localidades;
DROP POLICY IF EXISTS "precos_rotas_select" ON precos_rotas;
DROP POLICY IF EXISTS "precos_rotas_insert" ON precos_rotas;
DROP POLICY IF EXISTS "precos_rotas_update" ON precos_rotas;
DROP POLICY IF EXISTS "precos_rotas_delete" ON precos_rotas;
DROP POLICY IF EXISTS "regras_horario_select" ON regras_horario;
DROP POLICY IF EXISTS "regras_horario_insert" ON regras_horario;
DROP POLICY IF EXISTS "regras_horario_update" ON regras_horario;
DROP POLICY IF EXISTS "regras_horario_delete" ON regras_horario;
DROP POLICY IF EXISTS "historico_precos_select" ON historico_precos;
DROP POLICY IF EXISTS "historico_precos_insert" ON historico_precos;
DROP POLICY IF EXISTS "historico_precos_update" ON historico_precos;
DROP POLICY IF EXISTS "historico_precos_delete" ON historico_precos;
DROP POLICY IF EXISTS "tabela_precos_select" ON tabela_precos;
DROP POLICY IF EXISTS "tabela_precos_insert" ON tabela_precos;
DROP POLICY IF EXISTS "tabela_precos_update" ON tabela_precos;
DROP POLICY IF EXISTS "tabela_precos_delete" ON tabela_precos;

-- ── Create explicit per-operation policies ──
-- localidades
CREATE POLICY "localidades_select" ON localidades FOR SELECT USING (true);
CREATE POLICY "localidades_insert" ON localidades FOR INSERT WITH CHECK (true);
CREATE POLICY "localidades_update" ON localidades FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "localidades_delete" ON localidades FOR DELETE USING (true);

-- precos_rotas
CREATE POLICY "precos_rotas_select" ON precos_rotas FOR SELECT USING (true);
CREATE POLICY "precos_rotas_insert" ON precos_rotas FOR INSERT WITH CHECK (true);
CREATE POLICY "precos_rotas_update" ON precos_rotas FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "precos_rotas_delete" ON precos_rotas FOR DELETE USING (true);

-- regras_horario
CREATE POLICY "regras_horario_select" ON regras_horario FOR SELECT USING (true);
CREATE POLICY "regras_horario_insert" ON regras_horario FOR INSERT WITH CHECK (true);
CREATE POLICY "regras_horario_update" ON regras_horario FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "regras_horario_delete" ON regras_horario FOR DELETE USING (true);

-- historico_precos
CREATE POLICY "historico_precos_select" ON historico_precos FOR SELECT USING (true);
CREATE POLICY "historico_precos_insert" ON historico_precos FOR INSERT WITH CHECK (true);
CREATE POLICY "historico_precos_update" ON historico_precos FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "historico_precos_delete" ON historico_precos FOR DELETE USING (true);

-- tabela_precos
CREATE POLICY "tabela_precos_select" ON tabela_precos FOR SELECT USING (true);
CREATE POLICY "tabela_precos_insert" ON tabela_precos FOR INSERT WITH CHECK (true);
CREATE POLICY "tabela_precos_update" ON tabela_precos FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "tabela_precos_delete" ON tabela_precos FOR DELETE USING (true);

-- ── Grant access to anon and authenticated roles ──
GRANT ALL ON localidades TO anon, authenticated;
GRANT ALL ON precos_rotas TO anon, authenticated;
GRANT ALL ON regras_horario TO anon, authenticated;
GRANT ALL ON historico_precos TO anon, authenticated;
GRANT ALL ON tabela_precos TO anon, authenticated;

-- ── Ensure Realtime publications ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'localidades'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE localidades;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'precos_rotas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE precos_rotas;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'regras_horario'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE regras_horario;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'tabela_precos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tabela_precos;
  END IF;
END $$;

-- ═══ FORCE PostgREST to reload its schema cache ═══
NOTIFY pgrst, 'reload schema';
