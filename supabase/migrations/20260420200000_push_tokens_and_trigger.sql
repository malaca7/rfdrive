-- ================================================================
-- Push Tokens + Trigger para enviar push via Edge Function
-- ================================================================

-- Tabela para armazenar tokens FCM dos dispositivos
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL DEFAULT 'android', -- 'android' ou 'ios'
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, token)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON public.push_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON public.push_tokens (token);

-- RLS
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_tokens_user_manage" ON public.push_tokens;
CREATE POLICY "push_tokens_user_manage" ON public.push_tokens
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_tokens_service_read" ON public.push_tokens;
CREATE POLICY "push_tokens_service_read" ON public.push_tokens
  FOR SELECT USING (true);

-- ================================================================
-- Função que dispara push notification via Edge Function
-- Usa pg_net para chamar a Edge Function assincronamente
-- ================================================================

-- Habilitar pg_net se não estiver habilitado
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.notify_push_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _supabase_url text;
  _service_key text;
  _payload jsonb;
BEGIN
  -- Pegar URL e chave do Supabase via configuração  
  SELECT decrypted_secret INTO _service_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;

  -- Fallback: tentar de current_setting
  IF _service_key IS NULL THEN
    _service_key := current_setting('app.settings.service_role_key', true);
  END IF;

  SELECT decrypted_secret INTO _supabase_url
    FROM vault.decrypted_secrets
    WHERE name = 'supabase_url'
    LIMIT 1;

  IF _supabase_url IS NULL THEN
    _supabase_url := current_setting('app.settings.supabase_url', true);
  END IF;

  -- Se não temos as configurações, sair silenciosamente
  IF _supabase_url IS NULL OR _service_key IS NULL THEN
    RETURN NEW;
  END IF;

  _payload := jsonb_build_object(
    'notification_id', NEW.id,
    'titulo', NEW.titulo,
    'mensagem', NEW.mensagem,
    'tipo', NEW.tipo,
    'destinatario', NEW.destinatario,
    'user_id', NEW.user_id
  );

  -- Chamar Edge Function via pg_net
  PERFORM extensions.http_post(
    url := _supabase_url || '/functions/v1/send-push',
    body := _payload::text,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _service_key
    )
  );

  RETURN NEW;
END;
$$;

-- Trigger no INSERT de notifications
DROP TRIGGER IF EXISTS trigger_push_on_notification ON public.notifications;
CREATE TRIGGER trigger_push_on_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_push_on_insert();

NOTIFY pgrst, 'reload schema';
