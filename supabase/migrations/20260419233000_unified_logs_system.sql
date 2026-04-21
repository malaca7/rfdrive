-- ================================================================
-- Unified Logs System (audit_logs, activity_logs, system_logs)
-- ================================================================

-- 1) Core tables
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity text,
  entity_id text,
  "before" jsonb,
  "after" jsonb,
  ip text,
  user_agent text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity text,
  entity_id text,
  "before" jsonb,
  "after" jsonb,
  ip text,
  user_agent text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity text,
  entity_id text,
  "before" jsonb,
  "after" jsonb,
  ip text,
  user_agent text,
  details jsonb,
  level text NOT NULL DEFAULT 'error',
  error_message text,
  stack_trace text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Indexes for pagination and filters
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON public.audit_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs (entity, entity_id);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created ON public.activity_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON public.activity_logs (action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON public.activity_logs (entity, entity_id);

CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON public.system_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_user_created ON public.system_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_action ON public.system_logs (action);
CREATE INDEX IF NOT EXISTS idx_system_logs_entity ON public.system_logs (entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON public.system_logs (level, created_at DESC);

-- 3) Security helpers
CREATE OR REPLACE FUNCTION public.is_admin_or_ceo()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND (
        lower(coalesce(u.tipo, '')) IN ('admin', 'ceo')
        OR 'admin' = ANY(coalesce(u.roles, '{}'::text[]))
        OR 'ceo' = ANY(coalesce(u.roles, '{}'::text[]))
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_or_ceo() TO authenticated;

CREATE OR REPLACE FUNCTION public.mask_sensitive_json(input jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN input IS NULL THEN NULL
    ELSE input
      - 'senha'
      - 'password'
      - 'token'
      - 'access_token'
      - 'refresh_token'
      - 'authorization'
      - 'Authorization'
      - 'secret'
      - 'api_key'
      - 'service_role_key'
  END;
$$;

CREATE OR REPLACE FUNCTION public.trg_mask_logs()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."before" = public.mask_sensitive_json(NEW."before");
  NEW."after" = public.mask_sensitive_json(NEW."after");
  NEW.details = public.mask_sensitive_json(NEW.details);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mask_audit_logs ON public.audit_logs;
CREATE TRIGGER trg_mask_audit_logs
BEFORE INSERT OR UPDATE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.trg_mask_logs();

DROP TRIGGER IF EXISTS trg_mask_activity_logs ON public.activity_logs;
CREATE TRIGGER trg_mask_activity_logs
BEFORE INSERT OR UPDATE ON public.activity_logs
FOR EACH ROW EXECUTE FUNCTION public.trg_mask_logs();

DROP TRIGGER IF EXISTS trg_mask_system_logs ON public.system_logs;
CREATE TRIGGER trg_mask_system_logs
BEFORE INSERT OR UPDATE ON public.system_logs
FOR EACH ROW EXECUTE FUNCTION public.trg_mask_logs();

-- 4) RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_select_admin_ceo" ON public.audit_logs;
CREATE POLICY "audit_logs_select_admin_ceo"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin_or_ceo());

DROP POLICY IF EXISTS "activity_logs_select_admin_ceo" ON public.activity_logs;
CREATE POLICY "activity_logs_select_admin_ceo"
  ON public.activity_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin_or_ceo());

DROP POLICY IF EXISTS "system_logs_select_admin_ceo" ON public.system_logs;
CREATE POLICY "system_logs_select_admin_ceo"
  ON public.system_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin_or_ceo());

DROP POLICY IF EXISTS "audit_logs_insert_authenticated" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_authenticated"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL OR public.is_admin_or_ceo());

DROP POLICY IF EXISTS "activity_logs_insert_authenticated" ON public.activity_logs;
CREATE POLICY "activity_logs_insert_authenticated"
  ON public.activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL OR public.is_admin_or_ceo());

DROP POLICY IF EXISTS "system_logs_insert_authenticated" ON public.system_logs;
CREATE POLICY "system_logs_insert_authenticated"
  ON public.system_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL OR public.is_admin_or_ceo());

-- 5) Centralized function: log_event
CREATE OR REPLACE FUNCTION public.log_event(
  p_log_type text,
  p_user_id uuid,
  p_action text,
  p_entity text DEFAULT NULL,
  p_entity_id text DEFAULT NULL,
  p_before jsonb DEFAULT NULL,
  p_after jsonb DEFAULT NULL,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_details jsonb DEFAULT NULL,
  p_level text DEFAULT NULL,
  p_error_message text DEFAULT NULL,
  p_stack_trace text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_type text := lower(coalesce(p_log_type, 'activity'));
BEGIN
  IF v_type = 'audit' THEN
    INSERT INTO public.audit_logs (
      user_id, action, entity, entity_id, "before", "after", ip, user_agent, details
    ) VALUES (
      p_user_id, p_action, p_entity, p_entity_id, p_before, p_after, p_ip, p_user_agent, p_details
    ) RETURNING id INTO v_id;
  ELSIF v_type = 'system' THEN
    INSERT INTO public.system_logs (
      user_id, action, entity, entity_id, "before", "after", ip, user_agent, details, level, error_message, stack_trace
    ) VALUES (
      p_user_id, p_action, p_entity, p_entity_id, p_before, p_after, p_ip, p_user_agent, p_details,
      coalesce(nullif(lower(p_level), ''), 'error'), p_error_message, p_stack_trace
    ) RETURNING id INTO v_id;
  ELSE
    INSERT INTO public.activity_logs (
      user_id, action, entity, entity_id, "before", "after", ip, user_agent, details
    ) VALUES (
      p_user_id, p_action, p_entity, p_entity_id, p_before, p_after, p_ip, p_user_agent, p_details
    ) RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_event(
  text,
  uuid,
  text,
  text,
  text,
  jsonb,
  jsonb,
  text,
  text,
  jsonb,
  text,
  text,
  text
) TO authenticated;

-- 6) Compatibility bridge from old tables
DO $$
BEGIN
  IF to_regclass('public.platform_activity_log') IS NOT NULL THEN
    CREATE OR REPLACE FUNCTION public.bridge_platform_activity_to_activity_logs()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $fn$
    BEGIN
      INSERT INTO public.activity_logs (user_id, action, entity, entity_id, details, created_at)
      VALUES (NEW.user_id, NEW.action, NEW.entity, NEW.entity_id, NEW.details, NEW.created_at);
      RETURN NEW;
    END;
    $fn$;

    DROP TRIGGER IF EXISTS trg_bridge_platform_activity_to_activity_logs ON public.platform_activity_log;
    CREATE TRIGGER trg_bridge_platform_activity_to_activity_logs
    AFTER INSERT ON public.platform_activity_log
    FOR EACH ROW EXECUTE FUNCTION public.bridge_platform_activity_to_activity_logs();
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.rbac_audit_log') IS NOT NULL THEN
    CREATE OR REPLACE FUNCTION public.bridge_rbac_audit_to_audit_logs()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $fn$
    BEGIN
      INSERT INTO public.audit_logs (user_id, action, entity, entity_id, details, created_at)
      VALUES (NEW.actor_id, NEW.action, 'users', coalesce(NEW.target_id::text, NULL), NEW.details, NEW.created_at);
      RETURN NEW;
    END;
    $fn$;

    DROP TRIGGER IF EXISTS trg_bridge_rbac_audit_to_audit_logs ON public.rbac_audit_log;
    CREATE TRIGGER trg_bridge_rbac_audit_to_audit_logs
    AFTER INSERT ON public.rbac_audit_log
    FOR EACH ROW EXECUTE FUNCTION public.bridge_rbac_audit_to_audit_logs();
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
