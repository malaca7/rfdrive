-- ═══════════════════════════════════════════════════════════════
-- FIX DEFINITIVO: Todas as tabelas + schema cache + GRANTs
-- Resolve: "Could not find table 'public.regras_horario' in schema cache"
-- Resolve: editar rota não salvando (tabela_precos)
-- ═══════════════════════════════════════════════════════════════

-- ══ 1. Criar todas as tabelas se não existem ══

CREATE TABLE IF NOT EXISTS public.localidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'bairro' CHECK (tipo IN ('bairro', 'local', 'rua', 'ponto', 'cidade', 'zona')),
  parent_id UUID REFERENCES public.localidades(id) ON DELETE SET NULL,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.precos_rotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origem_id UUID NOT NULL,
  destino_id UUID NOT NULL,
  preco_fixo NUMERIC(10,2),
  preco_minimo NUMERIC(10,2),
  prioridade INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Adicionar FK se não existir (idempotente via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'precos_rotas_origem_id_fkey' AND table_name = 'precos_rotas'
  ) THEN
    ALTER TABLE public.precos_rotas
      ADD CONSTRAINT precos_rotas_origem_id_fkey FOREIGN KEY (origem_id) REFERENCES public.localidades(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'precos_rotas_destino_id_fkey' AND table_name = 'precos_rotas'
  ) THEN
    ALTER TABLE public.precos_rotas
      ADD CONSTRAINT precos_rotas_destino_id_fkey FOREIGN KEY (destino_id) REFERENCES public.localidades(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.regras_horario (
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

CREATE TABLE IF NOT EXISTS public.historico_precos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  corrida_id UUID REFERENCES public.corridas(id) ON DELETE SET NULL,
  origem_localidade_id UUID REFERENCES public.localidades(id) ON DELETE SET NULL,
  destino_localidade_id UUID REFERENCES public.localidades(id) ON DELETE SET NULL,
  preco_rota_id UUID REFERENCES public.precos_rotas(id) ON DELETE SET NULL,
  regra_horario_id UUID REFERENCES public.regras_horario(id) ON DELETE SET NULL,
  preco_base NUMERIC(10,2),
  ajuste_aplicado TEXT,
  preco_final NUMERIC(10,2) NOT NULL,
  origem_regra TEXT,
  detalhes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tabela_precos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origem TEXT NOT NULL,
  destino TEXT NOT NULL,
  valor NUMERIC(10,2) NOT NULL,
  regiao TEXT NOT NULL DEFAULT 'Cabo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Adicionar UNIQUE constraint se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tabela_precos_origem_destino_key' AND table_name = 'tabela_precos'
  ) THEN
    ALTER TABLE public.tabela_precos ADD CONSTRAINT tabela_precos_origem_destino_key UNIQUE(origem, destino);
  END IF;
END $$;

-- ══ 2. Habilitar RLS em todas ══
ALTER TABLE public.localidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.precos_rotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regras_horario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_precos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tabela_precos ENABLE ROW LEVEL SECURITY;

-- ══ 3. Dropar TODAS as policies existentes (limpar) ══
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('localidades', 'precos_rotas', 'regras_horario', 'historico_precos', 'tabela_precos')
  )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ══ 4. Criar policies abertas (per-operation) ══
-- localidades
CREATE POLICY "localidades_select" ON public.localidades FOR SELECT USING (true);
CREATE POLICY "localidades_insert" ON public.localidades FOR INSERT WITH CHECK (true);
CREATE POLICY "localidades_update" ON public.localidades FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "localidades_delete" ON public.localidades FOR DELETE USING (true);

-- precos_rotas
CREATE POLICY "precos_rotas_select" ON public.precos_rotas FOR SELECT USING (true);
CREATE POLICY "precos_rotas_insert" ON public.precos_rotas FOR INSERT WITH CHECK (true);
CREATE POLICY "precos_rotas_update" ON public.precos_rotas FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "precos_rotas_delete" ON public.precos_rotas FOR DELETE USING (true);

-- regras_horario
CREATE POLICY "regras_horario_select" ON public.regras_horario FOR SELECT USING (true);
CREATE POLICY "regras_horario_insert" ON public.regras_horario FOR INSERT WITH CHECK (true);
CREATE POLICY "regras_horario_update" ON public.regras_horario FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "regras_horario_delete" ON public.regras_horario FOR DELETE USING (true);

-- historico_precos
CREATE POLICY "historico_precos_select" ON public.historico_precos FOR SELECT USING (true);
CREATE POLICY "historico_precos_insert" ON public.historico_precos FOR INSERT WITH CHECK (true);
CREATE POLICY "historico_precos_update" ON public.historico_precos FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "historico_precos_delete" ON public.historico_precos FOR DELETE USING (true);

-- tabela_precos
CREATE POLICY "tabela_precos_select" ON public.tabela_precos FOR SELECT USING (true);
CREATE POLICY "tabela_precos_insert" ON public.tabela_precos FOR INSERT WITH CHECK (true);
CREATE POLICY "tabela_precos_update" ON public.tabela_precos FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "tabela_precos_delete" ON public.tabela_precos FOR DELETE USING (true);

-- ══ 5. GRANT ALL para anon e authenticated ══
GRANT ALL ON public.localidades TO anon, authenticated;
GRANT ALL ON public.precos_rotas TO anon, authenticated;
GRANT ALL ON public.regras_horario TO anon, authenticated;
GRANT ALL ON public.historico_precos TO anon, authenticated;
GRANT ALL ON public.tabela_precos TO anon, authenticated;

-- Também garantir que sequences estão acessíveis
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- ══ 6. Publicar para Realtime ══
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['localidades', 'precos_rotas', 'regras_horario', 'tabela_precos']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- ══ 7. FORÇAR PostgREST a recarregar schema cache ══
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
