-- ═══════════════════════════════════════════════════════════════
-- MULTI-ROLE SYSTEM
-- Permite que usuários tenham múltiplas funções
-- ═══════════════════════════════════════════════════════════════

-- Adicionar coluna de roles (array de text)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS roles text[] DEFAULT ARRAY['cliente'::text];

-- Backfill: preencher roles baseado no tipo atual
UPDATE public.users SET roles = ARRAY['cliente'] WHERE tipo = 'cliente' AND (roles IS NULL OR roles = ARRAY['cliente'::text]);
UPDATE public.users SET roles = ARRAY['cliente', 'motorista'] WHERE tipo = 'motorista' AND (roles IS NULL OR roles = ARRAY['cliente'::text]);
UPDATE public.users SET roles = ARRAY['cliente', 'admin'] WHERE tipo = 'admin' AND (roles IS NULL OR roles = ARRAY['cliente'::text]);
