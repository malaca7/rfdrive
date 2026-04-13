-- Fix RLS policies to explicitly allow DELETE on all tables
-- The existing "FOR ALL" policies should work, but we replace them
-- with explicit separate policies to ensure DELETE is covered.

-- ── corridas ──
DROP POLICY IF EXISTS "corridas_all_access" ON public.corridas;
CREATE POLICY "corridas_select" ON public.corridas FOR SELECT USING (true);
CREATE POLICY "corridas_insert" ON public.corridas FOR INSERT WITH CHECK (true);
CREATE POLICY "corridas_update" ON public.corridas FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "corridas_delete" ON public.corridas FOR DELETE USING (true);

-- ── users ──
DROP POLICY IF EXISTS "users_all_access" ON public.users;
CREATE POLICY "users_select" ON public.users FOR SELECT USING (true);
CREATE POLICY "users_insert" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "users_update" ON public.users FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "users_delete" ON public.users FOR DELETE USING (true);

-- ── aprovacoes ──
DROP POLICY IF EXISTS "aprovacoes_all_access" ON public.aprovacoes;
CREATE POLICY "aprovacoes_select" ON public.aprovacoes FOR SELECT USING (true);
CREATE POLICY "aprovacoes_insert" ON public.aprovacoes FOR INSERT WITH CHECK (true);
CREATE POLICY "aprovacoes_update" ON public.aprovacoes FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "aprovacoes_delete" ON public.aprovacoes FOR DELETE USING (true);

-- ── avaliacoes ──
DROP POLICY IF EXISTS "avaliacoes_all_access" ON public.avaliacoes;
CREATE POLICY "avaliacoes_select" ON public.avaliacoes FOR SELECT USING (true);
CREATE POLICY "avaliacoes_insert" ON public.avaliacoes FOR INSERT WITH CHECK (true);
CREATE POLICY "avaliacoes_update" ON public.avaliacoes FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "avaliacoes_delete" ON public.avaliacoes FOR DELETE USING (true);

-- ── historico_precos ──
DROP POLICY IF EXISTS "historico_precos_all" ON public.historico_precos;
CREATE POLICY "historico_precos_select" ON public.historico_precos FOR SELECT USING (true);
CREATE POLICY "historico_precos_insert" ON public.historico_precos FOR INSERT WITH CHECK (true);
CREATE POLICY "historico_precos_update" ON public.historico_precos FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "historico_precos_delete" ON public.historico_precos FOR DELETE USING (true);
