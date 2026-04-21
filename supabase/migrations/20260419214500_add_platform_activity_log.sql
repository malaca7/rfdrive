-- ================================================================
-- Activity Log: trilha geral de ações de usuários
-- ================================================================

CREATE TABLE IF NOT EXISTS public.platform_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  category text NOT NULL,
  entity text,
  entity_id text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_activity_log_created_at
  ON public.platform_activity_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_activity_log_user_id
  ON public.platform_activity_log (user_id);

ALTER TABLE public.platform_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_activity_log_all_access" ON public.platform_activity_log;
CREATE POLICY "platform_activity_log_all_access"
  ON public.platform_activity_log
  FOR ALL
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
