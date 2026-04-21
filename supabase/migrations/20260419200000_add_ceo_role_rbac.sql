-- ================================================================
-- RBAC: Adicionar role CEO ao sistema
-- ================================================================

-- 1. Atualizar CHECK constraint em users.tipo para incluir 'ceo'
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_tipo_check;
ALTER TABLE public.users ADD CONSTRAINT users_tipo_check
  CHECK (tipo IN ('cliente', 'motorista', 'admin', 'ceo'));

-- 2. Adicionar coluna de log de ações críticas
CREATE TABLE IF NOT EXISTS public.rbac_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rbac_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_log_all_access" ON public.rbac_audit_log;
CREATE POLICY "audit_log_all_access" ON public.rbac_audit_log FOR ALL USING (true) WITH CHECK (true);

-- 3. Definir usuário 81996138924 como CEO
UPDATE public.users
SET
  tipo = 'ceo',
  roles = ARRAY['ceo', 'admin', 'motorista']
WHERE telefone = '81996138924';

-- Log: promoção inicial do CEO
INSERT INTO public.rbac_audit_log (actor_id, target_id, action, details)
SELECT id, id, 'promote_to_ceo', '{"source": "migration", "note": "Initial CEO setup"}'::jsonb
FROM public.users
WHERE telefone = '81996138924'
LIMIT 1;
